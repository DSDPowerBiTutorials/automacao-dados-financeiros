import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Clinic Variations API
// Uses the SAME baseline Dec(year-1) logic as the Clinics Overview.
// Detects New / Pause / Return events via state machine.
// Churn = manual only (never auto-detected).
// Shows revenue in the specific FA code being drilled into.
// ============================================================

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

// Monthly-fee FA codes (102.1-102.4)
const CLINIC_FA_PREFIXES = ["102.1", "102.2", "102.3", "102.4"];
const isMonthlyFeeFA = (fa: string) => CLINIC_FA_PREFIXES.includes(fa);

const FA_LEVEL: Record<string, string> = {
    "102.1": "Level 3", "102.2": "Level 3",
    "102.3": "Level 3", "102.4": "Level 3",
    "103.1": "Level 3", "103.2": "Level 3",
    "103.3": "Level 3", "103.4": "Level 3",
    "103.5": "Level 2", "103.6": "Level 1",
    "103.7": "Not a Sub",
    "104.1": "Level 3", "104.2": "Level 3",
    "104.3": "Level 3", "104.4": "Level 3",
    "104.5": "Level 2", "104.6": "Level 1",
    "104.7": "Not a Sub",
};

function parseEuropeanNumber(value: unknown): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value);
    return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
}

function deriveRegion(faCode: string): string {
    if (["102.1", "102.3", "103.1", "103.3"].includes(faCode)) return "ROW";
    if (["102.2", "102.4", "103.2", "103.4", "104.1", "104.2", "104.3", "104.4"].includes(faCode)) return "AMEX";
    return "ROW";
}

function ym(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, "0")}`;
}

/** Paginated fetch */
async function fetchRows(source: string, dateFrom: string, dateTo: string): Promise<any[]> {
    let all: any[] = [];
    let offset = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from("csv_rows")
            .select("id, date, amount, custom_data")
            .eq("source", source)
            .gte("date", dateFrom)
            .lte("date", dateTo)
            .range(offset, offset + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        offset += PAGE;
    }
    return all;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get("month"); // YYYY-MM  (monthly mode)
    const ytd = searchParams.get("ytd");          // YYYY-MM  (ytd mode)
    const faCode = searchParams.get("fa");

    if (!yearMonth && !ytd) {
        return NextResponse.json({ error: "month or ytd required (format: YYYY-MM)" }, { status: 400 });
    }
    if (!faCode) {
        return NextResponse.json({ error: "fa (financial account code) required" }, { status: 400 });
    }

    try {
        const targetMonth = (ytd || yearMonth) as string;
        const [year, month] = targetMonth.split("-").map(Number);

        // ── 1. Baseline: Dec (year-1) monthly-fee revenue per clinic ──
        const baselineYear = year - 1;
        const [baselineTx, yearTx] = await Promise.all([
            fetchRows("invoice-orders", `${baselineYear}-12-01`, `${baselineYear}-12-31`),
            fetchRows("invoice-orders", `${year}-01-01`, `${year}-12-31`),
        ]);

        const baselineRevenue = new Map<string, number>();
        for (const tx of baselineTx) {
            const cd = tx.custom_data || {};
            const fa = String(cd.financial_account_code || "").trim();
            if (!isMonthlyFeeFA(fa)) continue;
            const name = String(cd.customer_name || "").trim();
            if (!name) continue;
            const amount = parseEuropeanNumber(tx.amount);
            baselineRevenue.set(name, (baselineRevenue.get(name) || 0) + amount);
        }

        // ── 2. Aggregate year transactions per clinic ──
        // monthlyFeeRevenue: per (clinic, YYYY-MM) sum of 102.x amounts
        // faRevenue: per (clinic, YYYY-MM) sum of amounts for the specific drilled FA code
        const clinicMonthlyFee = new Map<string, Map<string, number>>(); // name → (ym → amount)
        const clinicFARevenue = new Map<string, Map<string, number>>();  // name → (ym → amount)
        const clinicEmail = new Map<string, string>();

        const faLower = faCode.toLowerCase();

        for (const tx of yearTx) {
            const cd = tx.custom_data || {};
            const customerName = String(cd.customer_name || "").trim();
            if (!customerName) continue;
            const fa = String(cd.financial_account_code || "").trim();
            if (!fa) continue;
            const date = tx.date || "";
            const ymKey = date.substring(0, 7);
            const amount = parseEuropeanNumber(tx.amount);

            const email = String(cd.email || "").trim().toLowerCase();
            if (email && !clinicEmail.has(customerName)) clinicEmail.set(customerName, email);

            // Monthly fee revenue (102.x)
            if (isMonthlyFeeFA(fa)) {
                const m = clinicMonthlyFee.get(customerName) || new Map();
                m.set(ymKey, (m.get(ymKey) || 0) + amount);
                clinicMonthlyFee.set(customerName, m);
            }

            // Revenue in the specific drilled FA code
            if (fa.toLowerCase() === faLower || fa.toLowerCase().startsWith(faLower)) {
                const m = clinicFARevenue.get(customerName) || new Map();
                m.set(ymKey, (m.get(ymKey) || 0) + amount);
                clinicFARevenue.set(customerName, m);
            }
        }

        // Also ensure baseline clinics appear
        for (const [name] of baselineRevenue) {
            if (!clinicMonthlyFee.has(name)) clinicMonthlyFee.set(name, new Map());
        }

        // ── 3. Fetch manual clinic_events for the year ──
        const { data: manualEvents } = await supabaseAdmin
            .from("clinic_events")
            .select("*, clinics(name)")
            .gte("year_month", `${year}-01`)
            .lte("year_month", ym(year, month));

        const manualEventMap = new Map<string, any>(); // "name|YYYY-MM" → event
        for (const e of manualEvents || []) {
            const name = (e.clinics as any)?.name || "";
            if (name) manualEventMap.set(`${name}|${e.year_month}`, e);
        }

        // Fetch clinic IDs for the dropdown
        const { data: clinics } = await supabaseAdmin
            .from("clinics")
            .select("id, name");
        const clinicIdByName = new Map((clinics || []).map(c => [c.name, c.id]));

        // ── 4. State machine: detect events per clinic using baseline logic ──
        type EventType = "New" | "Pause" | "Return" | "Churn";
        type ClinicState = "active" | "inactive" | "paused";

        // Collect all clinic names
        const allClinicNames = new Set([
            ...baselineRevenue.keys(),
            ...clinicMonthlyFee.keys(),
        ]);

        // For each clinic, run state machine from month 1..month
        // Collect events that fall in the target range
        const targetEvents: {
            name: string;
            eventType: EventType;
            eventMonth: string;
            is_manual: boolean;
            confirmed: boolean;
        }[] = [];

        const rangeStart = ytd ? 1 : month;
        const rangeEnd = month;

        for (const name of allClinicNames) {
            const wasInBaseline = baselineRevenue.has(name);
            const feeMap = clinicMonthlyFee.get(name) || new Map();

            let state: ClinicState = wasInBaseline ? "active" : "inactive";

            for (let m = 1; m <= month; m++) {
                const ymKey = ym(year, m);
                const fee = feeMap.get(ymKey) || 0;
                const hasFee = fee > 0;

                const manualKey = `${name}|${ymKey}`;
                const manual = manualEventMap.get(manualKey);

                let detectedEvent: EventType | null = null;
                let isManual = false;
                let confirmed = false;

                if (manual) {
                    detectedEvent = manual.event_type as EventType;
                    isManual = true;
                    confirmed = manual.confirmed;
                    if (detectedEvent === "New" || detectedEvent === "Return") state = "active";
                    else if (detectedEvent === "Pause") state = "paused";
                    else if (detectedEvent === "Churn") state = "paused";
                } else {
                    if (hasFee) {
                        if (state === "inactive") {
                            detectedEvent = "New";
                            state = "active";
                        } else if (state === "paused") {
                            detectedEvent = "Return";
                            state = "active";
                        }
                    } else {
                        if (state === "active") {
                            detectedEvent = "Pause";
                            state = "paused";
                        }
                    }
                }

                // Collect if event is in the target range
                if (detectedEvent && m >= rangeStart && m <= rangeEnd) {
                    targetEvents.push({
                        name,
                        eventType: detectedEvent,
                        eventMonth: ymKey,
                        is_manual: isManual,
                        confirmed,
                    });
                }
            }
        }

        // ── 5. Build variations array ──
        // For each event, compute revenue change in the specific FA code
        const currentYM = ym(year, month);
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        const prevYM = ym(prevY, prevM);

        const variations: ClinicVariation[] = [];

        for (const evt of targetEvents) {
            const faMap = clinicFARevenue.get(evt.name) || new Map();

            let currentRev: number;
            let prevRev: number;

            if (ytd) {
                // YTD: sum all months 1..month
                currentRev = 0;
                for (let m = 1; m <= month; m++) {
                    currentRev += faMap.get(ym(year, m)) || 0;
                }
                prevRev = 0; // No previous YTD comparison needed — event-based
            } else {
                // Monthly: revenue in the target month vs previous month
                currentRev = faMap.get(currentYM) || 0;
                prevRev = faMap.get(prevYM) || 0;
                // If not in year data, check baseline for previous
                if (month === 1 && prevRev === 0 && baselineRevenue.has(evt.name)) {
                    // For Jan, "previous" is Dec baseline — but only for monthly fee
                    // Check if baseline had this specific FA code
                    for (const tx of baselineTx) {
                        const cd = tx.custom_data || {};
                        const name = String(cd.customer_name || "").trim();
                        const fa = String(cd.financial_account_code || "").trim();
                        if (name === evt.name && (fa.toLowerCase() === faLower || fa.toLowerCase().startsWith(faLower))) {
                            prevRev += parseEuropeanNumber(tx.amount);
                        }
                    }
                }
            }

            const change = currentRev - prevRev;
            const changePct = prevRev > 0 ? (change / prevRev) * 100 : (currentRev > 0 ? 100 : 0);

            variations.push({
                clinic_id: clinicIdByName.get(evt.name) || 0,
                customer_name: evt.name,
                region: deriveRegion(faCode),
                level: FA_LEVEL[faCode] || null,
                previous_revenue: prevRev,
                current_revenue: currentRev,
                change,
                change_percent: changePct,
                event_type: evt.eventType,
                event_confirmed: evt.confirmed,
                is_new: evt.eventType === "New",
                is_churned: evt.eventType === "Churn",
            });
        }

        // Sort: New first, then Churn, then by absolute change
        variations.sort((a, b) => {
            const order: Record<string, number> = { New: 0, Return: 1, Churn: 2, Pause: 3 };
            const oa = order[a.event_type || ""] ?? 4;
            const ob = order[b.event_type || ""] ?? 4;
            if (oa !== ob) return oa - ob;
            return Math.abs(b.change) - Math.abs(a.change);
        });

        // Summary
        const summary = {
            total_clinics: variations.length,
            new_clinics: variations.filter(v => v.is_new).length,
            churned_clinics: variations.filter(v => v.is_churned).length,
            paused_clinics: variations.filter(v => v.event_type === "Pause").length,
            returned_clinics: variations.filter(v => v.event_type === "Return").length,
            total_current_revenue: variations.reduce((s, v) => s + v.current_revenue, 0),
            total_previous_revenue: variations.reduce((s, v) => s + v.previous_revenue, 0),
            total_change: variations.reduce((s, v) => s + v.change, 0),
        };

        const periodLabel = ytd
            ? `${year}-01 to ${ym(year, month)}`
            : ym(year, month);

        return NextResponse.json({
            success: true,
            mode: ytd ? "ytd" : "monthly",
            faCode,
            period: periodLabel,
            comparison_period: ytd ? `${year - 1}-01 to ${ym(year - 1, month)}` : prevYM,
            variations,
            summary,
        });
    } catch (err) {
        console.error("Clinic variations API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
