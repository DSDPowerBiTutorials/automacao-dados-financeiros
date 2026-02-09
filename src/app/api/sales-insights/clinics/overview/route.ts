import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Sales Insights → Clinics Overview API
// Aggregates clinic data from multiple tables:
//   - csv_rows (invoice-orders) FA 102.x for raw transaction data
//   - clinics table for master data
//   - clinic_events for lifecycle events
// ============================================================

// Monthly fee clinic FA codes
const CLINIC_FA_PREFIXES = ["102.1", "102.2", "102.3", "102.4"];
const ALL_CLINIC_FA_PREFIXES = ["102.", "103.", "104."];

// Readable FA names
const FA_NAMES: Record<string, string> = {
    "102.1": "Contracted ROW",
    "102.2": "Contracted AMEX",
    "102.3": "Level 3 New ROW",
    "102.4": "Level 3 New AMEX",
    "102.5": "Consultancies",
    "102.6": "Marketing Coaching",
    "102.7": "Others",
    "103.1": "PC Level 3 ROW",
    "103.2": "PC Level 3 AMEX",
    "103.3": "PC Level 3 New ROW",
    "103.4": "PC Level 3 New AMEX",
    "103.5": "PC Level 2",
    "103.6": "PC Level 1",
    "103.7": "PC Not a Subscriber",
    "104.1": "LAB Level 3 ROW",
    "104.2": "LAB Level 3 AMEX",
    "104.3": "LAB Level 3 New ROW",
    "104.4": "LAB Level 3 New AMEX",
    "104.5": "LAB Level 2",
    "104.6": "LAB Level 1",
    "104.7": "LAB Not a Subscriber",
};

function parseEuropeanNumber(value: unknown): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value);
    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

function getLastDayOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth() + 1;
    const region = searchParams.get("region") || "all"; // ROW, AMEX, all

    try {
        // 1. Fetch ALL invoice-orders for the year (for clinic FA codes)
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        const currentMonthStart = `${year}-${String(month).padStart(2, "0")}-01`;
        const currentMonthEnd = getLastDayOfMonth(year, month);

        // Previous month
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
        const prevMonthEnd = getLastDayOfMonth(prevYear, prevMonth);

        // Fetch year data in pages
        let allYearTx: any[] = [];
        let offset = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, amount, custom_data")
                .eq("source", "invoice-orders")
                .gte("date", yearStart)
                .lte("date", yearEnd)
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allYearTx = allYearTx.concat(data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        // Also fetch previous month if it's in a different year
        let prevMonthTx: any[] = [];
        if (prevYear < year) {
            let pOffset = 0;
            while (true) {
                const { data, error } = await supabaseAdmin
                    .from("csv_rows")
                    .select("id, date, amount, custom_data")
                    .eq("source", "invoice-orders")
                    .gte("date", prevMonthStart)
                    .lte("date", prevMonthEnd)
                    .range(pOffset, pOffset + PAGE_SIZE - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                prevMonthTx = prevMonthTx.concat(data);
                if (data.length < PAGE_SIZE) break;
                pOffset += PAGE_SIZE;
            }
        }

        // Filter: only clinic-related FA codes (102.x, 103.x, 104.x)
        const isClinicFA = (fa: string) => ALL_CLINIC_FA_PREFIXES.some(p => fa.startsWith(p));
        const isMonthlyFeeFA = (fa: string) => CLINIC_FA_PREFIXES.includes(fa);

        const clinicTx = allYearTx.filter(tx => {
            const fa = tx.custom_data?.financial_account_code || "";
            return isClinicFA(fa);
        });

        // Add prev month tx if from different year
        if (prevYear < year) {
            const prevClinicTx = prevMonthTx.filter(tx => {
                const fa = tx.custom_data?.financial_account_code || "";
                return isClinicFA(fa);
            });
            clinicTx.push(...prevClinicTx);
        }

        // 2. Build per-clinic aggregated data
        interface ClinicData {
            name: string;
            email: string;
            region: string;
            monthlyRevenue: Map<string, number>; // YYYY-MM → revenue
            monthlyFeeRevenue: Map<string, number>; // Only 102.x monthly fees
            products: Map<string, { revenue: number; count: number }>; // FA code → totals
            totalRevenue: number;
            totalMonthlyFee: number;
            firstDate: string;
            lastDate: string;
            txCount: number;
        }

        const clinicMap = new Map<string, ClinicData>();

        for (const tx of clinicTx) {
            const cd = tx.custom_data || {};
            const customerName = String(cd.customer_name || "").trim();
            if (!customerName) continue;

            const fa = String(cd.financial_account_code || "").trim();
            if (!fa || !isClinicFA(fa)) continue;

            // Region filter
            const txRegion = fa.startsWith("102.") ?
                (["102.1", "102.3"].includes(fa) ? "ROW" : "AMEX") :
                fa.startsWith("103.") ? "ROW" : "AMEX";
            if (region !== "all" && txRegion !== region) continue;

            const amount = parseEuropeanNumber(tx.amount);
            const date = tx.date || "";
            const ym = date.substring(0, 7); // YYYY-MM
            const email = String(cd.email || "").trim().toLowerCase();

            let clinic = clinicMap.get(customerName);
            if (!clinic) {
                clinic = {
                    name: customerName,
                    email: email,
                    region: txRegion,
                    monthlyRevenue: new Map(),
                    monthlyFeeRevenue: new Map(),
                    products: new Map(),
                    totalRevenue: 0,
                    totalMonthlyFee: 0,
                    firstDate: date,
                    lastDate: date,
                    txCount: 0,
                };
                clinicMap.set(customerName, clinic);
            }

            // Update email if we didn't have one
            if (!clinic.email && email) clinic.email = email;

            // Monthly revenue
            clinic.monthlyRevenue.set(ym, (clinic.monthlyRevenue.get(ym) || 0) + amount);

            // Monthly fee revenue (only 102.x)
            if (isMonthlyFeeFA(fa)) {
                clinic.monthlyFeeRevenue.set(ym, (clinic.monthlyFeeRevenue.get(ym) || 0) + amount);
                clinic.totalMonthlyFee += amount;
            }

            // Products breakdown
            const prod = clinic.products.get(fa) || { revenue: 0, count: 0 };
            prod.revenue += amount;
            prod.count += 1;
            clinic.products.set(fa, prod);

            clinic.totalRevenue += amount;
            clinic.txCount += 1;
            if (date < clinic.firstDate) clinic.firstDate = date;
            if (date > clinic.lastDate) clinic.lastDate = date;
        }

        // 3. Fetch clinic_events for the year
        const { data: events } = await supabaseAdmin
            .from("clinic_events")
            .select("*, clinics(name)")
            .gte("year_month", `${year}-01`)
            .lte("year_month", `${year}-${String(month).padStart(2, "0")}`);

        // Map events by clinic name for easier lookup
        const eventsByName = new Map<string, any[]>();
        for (const e of events || []) {
            const name = (e.clinics as any)?.name || "";
            if (!name) continue;
            const list = eventsByName.get(name) || [];
            list.push(e);
            eventsByName.set(name, list);
        }

        // 4. Determine status for each clinic
        const currentYM = `${year}-${String(month).padStart(2, "0")}`;
        const prevYM = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

        interface ClinicRow {
            name: string;
            email: string;
            region: string;
            status: "active" | "paused" | "churned" | "new";
            current_mrr: number;
            previous_mrr: number;
            mrr_change: number;
            mrr_change_pct: number;
            total_revenue_ytd: number;
            total_monthly_fee_ytd: number;
            first_date: string;
            last_date: string;
            tx_count: number;
            products: { code: string; name: string; revenue: number; count: number }[];
            events: { type: string; month: string; confirmed: boolean }[];
            months_active: number;
            consecutive_months: number;
        }

        const clinicRows: ClinicRow[] = [];

        for (const [name, data] of clinicMap) {
            const currentMRR = data.monthlyFeeRevenue.get(currentYM) || 0;
            const prevMRR = data.monthlyFeeRevenue.get(prevYM) || 0;
            const mrrChange = currentMRR - prevMRR;
            const mrrChangePct = prevMRR > 0 ? (mrrChange / prevMRR) * 100 : (currentMRR > 0 ? 100 : 0);

            // Check events for status
            const clinicEvents = eventsByName.get(name) || [];
            const latestEvent = clinicEvents.sort((a: any, b: any) =>
                b.year_month.localeCompare(a.year_month)
            )[0];

            let status: "active" | "paused" | "churned" | "new" = "active";
            if (latestEvent) {
                if (latestEvent.event_type === "Churn") status = "churned";
                else if (latestEvent.event_type === "Pause") status = "paused";
                else if (latestEvent.event_type === "New") status = "new";
                else if (latestEvent.event_type === "Return") status = "active";
            } else {
                // No events — determine from data
                if (currentMRR > 0 && prevMRR === 0) {
                    // Check if truly new (no monthly fee before current month)
                    const hasOlderFees = [...data.monthlyFeeRevenue.keys()].some(ym => ym < currentYM);
                    if (!hasOlderFees) status = "new";
                } else if (currentMRR === 0 && prevMRR > 0) {
                    status = "paused";
                } else if (currentMRR === 0 && prevMRR === 0) {
                    // Check if had any monthly fee this year
                    const hasAnyFees = data.monthlyFeeRevenue.size > 0;
                    status = hasAnyFees ? "churned" : "churned";
                }
            }

            // Count months with monthly fee revenue
            const monthsActive = data.monthlyFeeRevenue.size;

            // Consecutive months from most recent
            const sortedMonths = [...data.monthlyFeeRevenue.keys()].sort().reverse();
            let consecutive = 0;
            if (sortedMonths.length > 0) {
                let expectedYM = currentYM;
                for (const ym of sortedMonths) {
                    if (ym === expectedYM) {
                        consecutive++;
                        // Move to previous month
                        const [y, m] = expectedYM.split("-").map(Number);
                        const pm = m === 1 ? 12 : m - 1;
                        const py = m === 1 ? y - 1 : y;
                        expectedYM = `${py}-${String(pm).padStart(2, "0")}`;
                    } else if (ym < expectedYM) {
                        break;
                    }
                }
            }

            // Products breakdown
            const products = [...data.products.entries()].map(([code, d]) => ({
                code,
                name: FA_NAMES[code] || code,
                revenue: d.revenue,
                count: d.count,
            })).sort((a, b) => b.revenue - a.revenue);

            clinicRows.push({
                name,
                email: data.email,
                region: data.region,
                status,
                current_mrr: currentMRR,
                previous_mrr: prevMRR,
                mrr_change: mrrChange,
                mrr_change_pct: mrrChangePct,
                total_revenue_ytd: data.totalRevenue,
                total_monthly_fee_ytd: data.totalMonthlyFee,
                first_date: data.firstDate,
                last_date: data.lastDate,
                tx_count: data.txCount,
                products,
                events: clinicEvents.map((e: any) => ({
                    type: e.event_type,
                    month: e.year_month,
                    confirmed: e.confirmed,
                })),
                months_active: monthsActive,
                consecutive_months: consecutive,
            });
        }

        // Sort: active first, then by total revenue desc
        clinicRows.sort((a, b) => {
            const statusOrder = { active: 0, new: 0, paused: 1, churned: 2 };
            const sa = statusOrder[a.status] ?? 3;
            const sb = statusOrder[b.status] ?? 3;
            if (sa !== sb) return sa - sb;
            return b.total_revenue_ytd - a.total_revenue_ytd;
        });

        // 5. KPIs
        const activeClinics = clinicRows.filter(c => c.status === "active" || c.status === "new");
        const pausedClinics = clinicRows.filter(c => c.status === "paused");
        const churnedClinics = clinicRows.filter(c => c.status === "churned");
        const newClinics = clinicRows.filter(c => c.status === "new");

        const totalMRR = activeClinics.reduce((sum, c) => sum + c.current_mrr, 0);
        const avgMRR = activeClinics.length > 0 ? totalMRR / activeClinics.length : 0;
        const totalRevenueYTD = clinicRows.reduce((sum, c) => sum + c.total_revenue_ytd, 0);

        // Churn rate: churned / (active + churned) for the period
        const churnRate = (activeClinics.length + churnedClinics.length) > 0
            ? (churnedClinics.length / (activeClinics.length + churnedClinics.length)) * 100
            : 0;

        // 6. Monthly timeline (events by month)
        const timeline: { month: string; new: number; churn: number; pause: number; return: number; active_count: number; mrr: number }[] = [];
        for (let m = 1; m <= month; m++) {
            const ym = `${year}-${String(m).padStart(2, "0")}`;
            const monthEvents = (events || []).filter(e => e.year_month === ym);
            const monthActive = clinicRows.filter(c => {
                const rev = c.current_mrr; // simplified — just active ones
                return (c.status === "active" || c.status === "new") ||
                    [...(clinicMap.get(c.name)?.monthlyFeeRevenue.keys() || [])].includes(ym);
            });

            // Count clinics with monthly fee revenue in this month
            let monthMRR = 0;
            let monthActiveCount = 0;
            for (const [, data] of clinicMap) {
                const rev = data.monthlyFeeRevenue.get(ym) || 0;
                if (rev > 0) {
                    monthActiveCount++;
                    monthMRR += rev;
                }
            }

            timeline.push({
                month: ym,
                new: monthEvents.filter(e => e.event_type === "New").length,
                churn: monthEvents.filter(e => e.event_type === "Churn").length,
                pause: monthEvents.filter(e => e.event_type === "Pause").length,
                return: monthEvents.filter(e => e.event_type === "Return").length,
                active_count: monthActiveCount,
                mrr: monthMRR,
            });
        }

        return NextResponse.json({
            success: true,
            year,
            month,
            region,
            kpis: {
                total_clinics: clinicRows.length,
                active_clinics: activeClinics.length,
                paused_clinics: pausedClinics.length,
                churned_clinics: churnedClinics.length,
                new_clinics: newClinics.length,
                total_mrr: totalMRR,
                avg_mrr: avgMRR,
                total_revenue_ytd: totalRevenueYTD,
                churn_rate: churnRate,
                net_change: newClinics.length - churnedClinics.length,
            },
            clinics: clinicRows,
            timeline,
        });
    } catch (err: any) {
        console.error("Clinics overview API error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
