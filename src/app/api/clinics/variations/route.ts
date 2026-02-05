import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface ClinicVariation {
    clinic_id: number;
    customer_name: string;
    region: string | null;
    level: string | null;
    previous_revenue: number;
    current_revenue: number;
    change: number;
    change_percent: number;
    event_type: string | null;
    event_confirmed: boolean;
    is_new: boolean;
    is_churned: boolean;
}

// Parse European number format (dots = thousands, comma = decimal)
function parseEuropeanNumber(value: unknown): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value);
    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

// Derive region from FA code
function deriveRegion(faCode: string): string {
    // 102.x = ROW, 103.x = Planning Center, 104.x = LAB (AMEX)
    if (faCode.startsWith("102.")) return "ROW";
    if (faCode.startsWith("103.")) return "ROW"; // Planning Center is ROW
    if (faCode.startsWith("104.")) return "AMEX";
    return "Unknown";
}

// Derive level from FA code subcode
function deriveLevel(faCode: string): string | null {
    const parts = faCode.split(".");
    if (parts.length < 2) return null;
    const subcode = parseInt(parts[1]);
    // 1-3 = Level mapping
    if (subcode === 1) return "Level 3"; // Contracted
    if (subcode === 2) return "Level 2";
    if (subcode === 3) return "Level 1";
    return null;
}

// Helper: Get last day of month (avoid invalid dates like Feb 31)
function getLastDayOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate(); // month is 1-indexed here
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get("month"); // Format: YYYY-MM
    const ytd = searchParams.get("ytd"); // Format: YYYY-MM (get all months up to this one)
    const faCode = searchParams.get("fa"); // Financial account code filter (e.g., "102.1")

    if (!yearMonth && !ytd) {
        return NextResponse.json(
            { error: "month or ytd required (format: YYYY-MM)" },
            { status: 400 }
        );
    }

    if (!faCode) {
        return NextResponse.json(
            { error: "fa (financial account code) required" },
            { status: 400 }
        );
    }

    try {
        const targetMonth = (ytd || yearMonth) as string;
        const [year, month] = targetMonth.split("-").map(Number);

        // Calculate periods
        const currentYearMonth = `${year}-${String(month).padStart(2, "0")}`;
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

        // Build date ranges for queries
        let currentStartDate: string;
        let currentEndDate: string;
        let prevStartDate: string;
        let prevEndDate: string;

        if (ytd) {
            // YTD: Jan 1 to end of target month
            currentStartDate = `${year}-01-01`;
            currentEndDate = getLastDayOfMonth(year, month);
            // Previous year same period
            prevStartDate = `${year - 1}-01-01`;
            prevEndDate = getLastDayOfMonth(year - 1, month);
        } else {
            // Monthly: just the target month vs previous month
            currentStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
            currentEndDate = getLastDayOfMonth(year, month);
            prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
            prevEndDate = getLastDayOfMonth(prevYear, prevMonth);
        }

        // Fetch current period transactions with specific FA code
        const { data: currentTx, error: currentError } = await supabaseAdmin
            .from("csv_rows")
            .select("id, date, amount, custom_data")
            .eq("source", "invoice-orders")
            .gte("date", currentStartDate)
            .lte("date", currentEndDate);

        if (currentError) {
            console.error("Error fetching current transactions:", currentError);
            return NextResponse.json(
                { error: "Failed to fetch current data: " + currentError.message },
                { status: 500 }
            );
        }

        // Filter by FA code for this view (case-insensitive, same as drilldown API)
        const faLower = faCode.toLowerCase();
        const currentFiltered = (currentTx || []).filter((tx) => {
            const fa = (tx.custom_data?.financial_account_code || "").toLowerCase();
            return fa === faLower || fa.startsWith(faLower);
        });

        // Also get ALL clinic transactions (102.x, 103.x, 104.x) to check if customer is still active in another level
        const allCurrentClinicCustomers = new Set<string>();
        for (const tx of currentTx || []) {
            const fa = tx.custom_data?.financial_account_code || "";
            if (fa.startsWith("102.") || fa.startsWith("103.") || fa.startsWith("104.")) {
                const customerName = tx.custom_data?.customer_name || "";
                if (customerName) allCurrentClinicCustomers.add(customerName);
            }
        }

        // Fetch previous period transactions
        const { data: prevTx, error: prevError } = await supabaseAdmin
            .from("csv_rows")
            .select("id, date, amount, custom_data")
            .eq("source", "invoice-orders")
            .gte("date", prevStartDate)
            .lte("date", prevEndDate);

        if (prevError) {
            console.error("Error fetching previous transactions:", prevError);
            return NextResponse.json(
                { error: "Failed to fetch previous data: " + prevError.message },
                { status: 500 }
            );
        }

        // Filter previous by same FA code (case-insensitive)
        const prevFiltered = (prevTx || []).filter((tx) => {
            const fa = (tx.custom_data?.financial_account_code || "").toLowerCase();
            return fa === faLower || fa.startsWith(faLower);
        });

        // Also get ALL previous clinic customers to detect true churns
        const allPrevClinicCustomers = new Set<string>();
        for (const tx of prevTx || []) {
            const fa = tx.custom_data?.financial_account_code || "";
            if (fa.startsWith("102.") || fa.startsWith("103.") || fa.startsWith("104.")) {
                const customerName = tx.custom_data?.customer_name || "";
                if (customerName) allPrevClinicCustomers.add(customerName);
            }
        }

        // 3-MONTH LOOKBACK for churn detection (handles quarterly billing)
        // Calculate 3-month lookback period (for monthly mode only)
        let lookbackClinicCustomers = new Set<string>();
        if (!ytd) {
            // Go back 3 months from current month
            const lookbackMonths: { startDate: string; endDate: string }[] = [];
            for (let i = 1; i <= 3; i++) {
                let lbMonth = month - i;
                let lbYear = year;
                while (lbMonth <= 0) {
                    lbMonth += 12;
                    lbYear -= 1;
                }
                const lbStartDate = `${lbYear}-${String(lbMonth).padStart(2, "0")}-01`;
                const lbEndDate = getLastDayOfMonth(lbYear, lbMonth);
                lookbackMonths.push({ startDate: lbStartDate, endDate: lbEndDate });
            }

            // Query last 3 months for clinic customers
            const firstMonth = lookbackMonths[lookbackMonths.length - 1];
            const lastMonth = lookbackMonths[0];
            const { data: lookbackTx } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, amount, custom_data")
                .eq("source", "invoice-orders")
                .gte("date", firstMonth.startDate)
                .lte("date", lastMonth.endDate);

            // Build set of customers who had ANY clinic transaction in last 3 months
            for (const tx of lookbackTx || []) {
                const fa = tx.custom_data?.financial_account_code || "";
                if (fa.startsWith("102.") || fa.startsWith("103.") || fa.startsWith("104.")) {
                    const customerName = tx.custom_data?.customer_name || "";
                    if (customerName) lookbackClinicCustomers.add(customerName);
                }
            }
        } else {
            // For YTD mode, use the previous period customers
            lookbackClinicCustomers = allPrevClinicCustomers;
        }

        // Aggregate current period by customer_name
        const currentMap = new Map<string, { revenue: number; count: number }>();
        for (const tx of currentFiltered) {
            const customerName = tx.custom_data?.customer_name || "Unknown";
            const amount = parseEuropeanNumber(tx.amount);
            const existing = currentMap.get(customerName) || { revenue: 0, count: 0 };
            existing.revenue += amount;
            existing.count += 1;
            currentMap.set(customerName, existing);
        }

        // Aggregate previous period by customer_name
        const prevMap = new Map<string, { revenue: number; count: number }>();
        for (const tx of prevFiltered) {
            const customerName = tx.custom_data?.customer_name || "Unknown";
            const amount = parseEuropeanNumber(tx.amount);
            const existing = prevMap.get(customerName) || { revenue: 0, count: 0 };
            existing.revenue += amount;
            existing.count += 1;
            prevMap.set(customerName, existing);
        }

        // Get all unique customers from both periods
        const allCustomers = new Set([...currentMap.keys(), ...prevMap.keys()]);

        // Fetch clinic records for events and IDs
        const { data: clinics } = await supabaseAdmin
            .from("clinics")
            .select("id, name, email, status, first_transaction_date");

        const clinicByName = new Map(
            (clinics || []).map((c) => [c.name, c])
        );

        // Fetch events for the period
        const eventsQuery = ytd
            ? supabaseAdmin
                .from("clinic_events")
                .select("*")
                .gte("year_month", `${year}-01`)
                .lte("year_month", currentYearMonth)
            : supabaseAdmin
                .from("clinic_events")
                .select("*")
                .eq("year_month", currentYearMonth);

        const { data: events } = await eventsQuery;

        // Map events by clinic_id
        const eventsMap = new Map<number, { event_type: string; confirmed: boolean }>();
        for (const e of events || []) {
            eventsMap.set(e.clinic_id, {
                event_type: e.event_type,
                confirmed: e.confirmed,
            });
        }

        // Build variations list - ONLY include REAL lifecycle events
        // Real events: New (first time in ANY clinic line) or Churn (left ALL clinic lines)
        const variations: ClinicVariation[] = [];

        for (const customerName of allCustomers) {
            const currentData = currentMap.get(customerName) || { revenue: 0, count: 0 };
            const prevData = prevMap.get(customerName) || { revenue: 0, count: 0 };

            // Check if had/has revenue in THIS specific FA code
            const hadRevenueInThisFABefore = prevData.revenue > 0;
            const hasRevenueInThisFANow = currentData.revenue > 0;

            // No change in this FA code = skip (not a lifecycle event for this line)
            if (hadRevenueInThisFABefore === hasRevenueInThisFANow) continue;

            const change = currentData.revenue - prevData.revenue;
            const changePercent = prevData.revenue > 0
                ? (change / prevData.revenue) * 100
                : currentData.revenue > 0 ? 100 : 0;

            const clinic = clinicByName.get(customerName);
            const clinicId = clinic?.id || 0;

            // Check if customer exists in ANY clinic FA code (102.1-102.4)
            const existsInAnyClinicNow = allCurrentClinicCustomers.has(customerName);
            const existedInAnyClinicBefore = allPrevClinicCustomers.has(customerName);
            // Use 3-month lookback for churn detection (handles quarterly billing)
            const existedInClinicLast3Months = lookbackClinicCustomers.has(customerName);

            let eventType: string | null = null;

            // ENTERED this FA code this month
            if (!hadRevenueInThisFABefore && hasRevenueInThisFANow) {
                if (!existedInAnyClinicBefore) {
                    // Truly new to DSD Clinics (not in ANY clinic line before)
                    eventType = "New";
                }
                // If existed in another clinic line before, don't show (level change, not new customer)
            }

            // LEFT this FA code this month  
            if (hadRevenueInThisFABefore && !hasRevenueInThisFANow) {
                if (!existsInAnyClinicNow && !existedInClinicLast3Months) {
                    // Truly churned from DSD Clinics (not in ANY clinic line now AND no activity in last 3 months)
                    eventType = "Churn";
                }
                // If still exists in another clinic line OR had activity in last 3 months, don't show as churn
            }

            // Get manual event override from events table
            const clinicEvent = clinicId ? eventsMap.get(clinicId) : null;
            if (clinicEvent?.event_type) {
                eventType = clinicEvent.event_type;
            }
            const eventConfirmed = clinicEvent?.confirmed ?? false;

            // ONLY include if there's a real lifecycle event
            if (eventType) {
                variations.push({
                    clinic_id: clinicId,
                    customer_name: customerName,
                    region: deriveRegion(faCode),
                    level: deriveLevel(faCode),
                    previous_revenue: prevData.revenue,
                    current_revenue: currentData.revenue,
                    change,
                    change_percent: changePercent,
                    event_type: eventType,
                    event_confirmed: eventConfirmed,
                    is_new: eventType === "New",
                    is_churned: eventType === "Churn",
                });
            }
        }

        // Sort by absolute change (largest first)
        variations.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

        // Calculate summary
        const summary = {
            total_clinics: variations.length,
            new_clinics: variations.filter((v) => v.is_new).length,
            churned_clinics: variations.filter((v) => v.is_churned).length,
            paused_clinics: variations.filter((v) => v.event_type === "Pause").length,
            returned_clinics: variations.filter((v) => v.event_type === "Return").length,
            total_current_revenue: variations.reduce((sum, v) => sum + v.current_revenue, 0),
            total_previous_revenue: variations.reduce((sum, v) => sum + v.previous_revenue, 0),
            total_change: variations.reduce((sum, v) => sum + v.change, 0),
        };

        return NextResponse.json({
            success: true,
            mode: ytd ? "ytd" : "monthly",
            faCode,
            period: ytd ? `${year}-01 to ${currentYearMonth}` : currentYearMonth,
            comparison_period: ytd ? `${year - 1}-01 to ${prevYearMonth}` : prevYearMonth,
            variations,
            summary,
        });
    } catch (err) {
        console.error("Clinic variations API error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
