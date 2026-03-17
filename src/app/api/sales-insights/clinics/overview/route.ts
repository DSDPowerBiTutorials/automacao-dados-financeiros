import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Sales Insights → Clinics Overview API
// Baseline logic: Dec (year-1) is the starting roster.
// Events (New / Pause / Return / Churn) are detected by comparing
// each month's monthly-fee revenue against the previous state.
// Manual events from clinic_events table override auto-detected ones.
// Churn is NEVER auto-detected — only set manually by the user.
// ============================================================

const CLINIC_FA_PREFIXES = ["102.1", "102.2", "102.3", "102.4"];
const ALL_CLINIC_FA_PREFIXES = ["102.", "103.", "104."];

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

function ym(y: number, m: number): string {
    return `${y}-${String(m).padStart(2, "0")}`;
}

/** Paginated fetch of csv_rows */
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
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : new Date().getMonth() + 1;
    const region = searchParams.get("region") || "all";

    try {
        const isClinicFA = (fa: string) => ALL_CLINIC_FA_PREFIXES.some(p => fa.startsWith(p));
        const isMonthlyFeeFA = (fa: string) => CLINIC_FA_PREFIXES.includes(fa);

        // ── 1. Fetch baseline (Dec year-1) + current year transactions ──
        const baselineYear = year - 1;
        const baselineStart = `${baselineYear}-12-01`;
        const baselineEnd = `${baselineYear}-12-31`;

        const [baselineTx, yearTx] = await Promise.all([
            fetchRows("invoice-orders", baselineStart, baselineEnd),
            fetchRows("invoice-orders", `${year}-01-01`, `${year}-12-31`),
        ]);

        // ── 2. Build baseline set: clinics with 102.x monthly fee in Dec (year-1) ──
        const baselineRevenue = new Map<string, number>();
        for (const tx of baselineTx) {
            const cd = tx.custom_data || {};
            const fa = String(cd.financial_account_code || "").trim();
            if (!isMonthlyFeeFA(fa)) continue;
            const name = String(cd.customer_name || "").trim();
            if (!name) continue;
            // Region filter
            const txRegion = ["102.1", "102.3"].includes(fa) ? "ROW" : "AMEX";
            if (region !== "all" && txRegion !== region) continue;
            const amount = parseEuropeanNumber(tx.amount);
            baselineRevenue.set(name, (baselineRevenue.get(name) || 0) + amount);
        }

        // ── 3. Aggregate year transactions per clinic ──
        interface ClinicData {
            name: string;
            email: string;
            region: string;
            monthlyRevenue: Map<string, number>;
            monthlyFeeRevenue: Map<string, number>;
            products: Map<string, { revenue: number; count: number }>;
            totalRevenue: number;
            totalMonthlyFee: number;
            firstDate: string;
            lastDate: string;
            txCount: number;
        }

        const clinicMap = new Map<string, ClinicData>();

        for (const tx of yearTx) {
            const cd = tx.custom_data || {};
            const customerName = String(cd.customer_name || "").trim();
            if (!customerName) continue;
            const fa = String(cd.financial_account_code || "").trim();
            if (!fa || !isClinicFA(fa)) continue;
            const txRegion = fa.startsWith("102.")
                ? (["102.1", "102.3"].includes(fa) ? "ROW" : "AMEX")
                : fa.startsWith("103.") ? "ROW" : "AMEX";
            if (region !== "all" && txRegion !== region) continue;

            const amount = parseEuropeanNumber(tx.amount);
            const date = tx.date || "";
            const ymKey = date.substring(0, 7);
            const email = String(cd.email || "").trim().toLowerCase();

            let clinic = clinicMap.get(customerName);
            if (!clinic) {
                clinic = {
                    name: customerName, email, region: txRegion,
                    monthlyRevenue: new Map(), monthlyFeeRevenue: new Map(),
                    products: new Map(), totalRevenue: 0, totalMonthlyFee: 0,
                    firstDate: date, lastDate: date, txCount: 0,
                };
                clinicMap.set(customerName, clinic);
            }
            if (!clinic.email && email) clinic.email = email;
            clinic.monthlyRevenue.set(ymKey, (clinic.monthlyRevenue.get(ymKey) || 0) + amount);
            if (isMonthlyFeeFA(fa)) {
                clinic.monthlyFeeRevenue.set(ymKey, (clinic.monthlyFeeRevenue.get(ymKey) || 0) + amount);
                clinic.totalMonthlyFee += amount;
            }
            const prod = clinic.products.get(fa) || { revenue: 0, count: 0 };
            prod.revenue += amount;
            prod.count += 1;
            clinic.products.set(fa, prod);
            clinic.totalRevenue += amount;
            clinic.txCount += 1;
            if (date < clinic.firstDate) clinic.firstDate = date;
            if (date > clinic.lastDate) clinic.lastDate = date;
        }

        // Also ensure baseline clinics appear even if they have zero year tx
        for (const [name] of baselineRevenue) {
            if (!clinicMap.has(name)) {
                clinicMap.set(name, {
                    name, email: "", region: "ROW",
                    monthlyRevenue: new Map(), monthlyFeeRevenue: new Map(),
                    products: new Map(), totalRevenue: 0, totalMonthlyFee: 0,
                    firstDate: "", lastDate: "", txCount: 0,
                });
            }
        }

        // ── 3b. Detect last month with actual monthly-fee data ──
        // If user selects March but only Jan has data, cap at Jan to avoid false churns
        let lastMonthWithData = 0;
        for (const [, cd] of clinicMap) {
            for (let m = 1; m <= month; m++) {
                if ((cd.monthlyFeeRevenue.get(ym(year, m)) || 0) > 0) {
                    if (m > lastMonthWithData) lastMonthWithData = m;
                }
            }
        }
        const effectiveMonth = lastMonthWithData > 0 ? lastMonthWithData : month;

        // ── 4. Fetch manual clinic_events for the year ──
        const { data: manualEvents } = await supabaseAdmin
            .from("clinic_events")
            .select("*, clinics(name)")
            .gte("year_month", `${year}-01`)
            .lte("year_month", ym(year, effectiveMonth));

        // Index manual events by (clinicName, yearMonth)
        const manualEventMap = new Map<string, any>(); // key: "name|YYYY-MM"
        const manualEventsByName = new Map<string, any[]>();
        for (const e of manualEvents || []) {
            const name = (e.clinics as any)?.name || "";
            if (!name) continue;
            manualEventMap.set(`${name}|${e.year_month}`, e);
            const list = manualEventsByName.get(name) || [];
            list.push(e);
            manualEventsByName.set(name, list);
        }

        // ── 5. Auto-detect events per clinic with baseline logic ──
        type EventType = "New" | "Pause" | "Return" | "Churn";
        type ClinicState = "active" | "inactive" | "paused";

        interface AutoEvent {
            type: EventType;
            month: string;  // YYYY-MM
            is_manual: boolean;
        }

        const currentYM = ym(year, effectiveMonth);
        const prevMonth = effectiveMonth === 1 ? 12 : effectiveMonth - 1;
        const prevYear = effectiveMonth === 1 ? year - 1 : year;
        const prevYM = ym(prevYear, prevMonth);

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
            auto_events: { type: string; month: string; is_manual: boolean }[];
            monthly_fees: Record<string, number>;
            baseline_mrr: number;
            was_in_baseline: boolean;
            months_active: number;
            consecutive_months: number;
        }

        // Timeline accumulators
        const timelineAutoEvents = new Map<string, { new: number; churn: number; pause: number; return: number }>();
        for (let m = 1; m <= effectiveMonth; m++) {
            timelineAutoEvents.set(ym(year, m), { new: 0, churn: 0, pause: 0, return: 0 });
        }

        const clinicRows: ClinicRow[] = [];

        for (const [name, data] of clinicMap) {
            const wasInBaseline = baselineRevenue.has(name);
            const baselineMRR = baselineRevenue.get(name) || 0;

            // Build monthly_fees map for months 1..effectiveMonth
            const monthlyFees: Record<string, number> = {};
            for (let m = 1; m <= effectiveMonth; m++) {
                const key = ym(year, m);
                monthlyFees[key] = data.monthlyFeeRevenue.get(key) || 0;
            }

            // Auto-detect events by iterating months 1..effectiveMonth
            const autoEvents: AutoEvent[] = [];
            let state: ClinicState = wasInBaseline ? "active" : "inactive";

            for (let m = 1; m <= effectiveMonth; m++) {
                const ymKey = ym(year, m);
                const fee = data.monthlyFeeRevenue.get(ymKey) || 0;
                const hasFee = fee > 0;

                // Check for manual override first
                const manualKey = `${name}|${ymKey}`;
                const manual = manualEventMap.get(manualKey);

                if (manual) {
                    // Manual event takes precedence
                    const mType = manual.event_type as EventType;
                    autoEvents.push({ type: mType, month: ymKey, is_manual: true });
                    // Update state based on manual event
                    if (mType === "New" || mType === "Return") state = "active";
                    else if (mType === "Pause") state = "paused";
                    else if (mType === "Churn") state = "paused"; // Churn keeps paused state
                    // Count in timeline
                    const tl = timelineAutoEvents.get(ymKey);
                    if (tl) {
                        if (mType === "New") tl.new++;
                        else if (mType === "Churn") tl.churn++;
                        else if (mType === "Pause") tl.pause++;
                        else if (mType === "Return") tl.return++;
                    }
                } else {
                    // Auto-detect based on state transitions
                    if (hasFee) {
                        if (state === "inactive") {
                            // Was never active (not in baseline) → New
                            autoEvents.push({ type: "New", month: ymKey, is_manual: false });
                            state = "active";
                            const tl = timelineAutoEvents.get(ymKey);
                            if (tl) tl.new++;
                        } else if (state === "paused") {
                            // Was paused, now has fee → Return
                            autoEvents.push({ type: "Return", month: ymKey, is_manual: false });
                            state = "active";
                            const tl = timelineAutoEvents.get(ymKey);
                            if (tl) tl.return++;
                        }
                        // else: state === "active" and still has fee → no event
                    } else {
                        if (state === "active") {
                            // Was active, now no fee → Churn
                            autoEvents.push({ type: "Churn", month: ymKey, is_manual: false });
                            state = "paused";
                            const tl = timelineAutoEvents.get(ymKey);
                            if (tl) tl.churn++;
                        }
                        // else: state === "inactive" or "paused" with no fee → no event
                    }
                }
            }

            // Final status from last event
            const currentMRR = data.monthlyFeeRevenue.get(currentYM) || 0;
            // When effectiveMonth=1, prevYM is Dec(year-1) which is the baseline period
            const prevMRR = effectiveMonth === 1 && wasInBaseline
                ? baselineMRR
                : (data.monthlyFeeRevenue.get(prevYM) || 0);

            let status: "active" | "paused" | "churned" | "new" = "active";
            if (autoEvents.length > 0) {
                const lastEvt = autoEvents[autoEvents.length - 1];
                if (lastEvt.type === "New") status = "new";
                else if (lastEvt.type === "Return") status = "active";
                else if (lastEvt.type === "Pause") status = "paused";
                else if (lastEvt.type === "Churn") status = "churned";
            } else {
                // No events at all — was in baseline and still active, or inactive with no activity
                if (wasInBaseline && currentMRR > 0) status = "active";
                else if (wasInBaseline && currentMRR === 0) status = "churned";
                else if (!wasInBaseline && currentMRR > 0) status = "new";
                else status = "churned"; // inactive with no revenue
            }

            // Skip clinics that were never in baseline AND never had any year transactions
            if (!wasInBaseline && data.txCount === 0) continue;

            const mrrChange = currentMRR - prevMRR;
            const mrrChangePct = prevMRR > 0 ? (mrrChange / prevMRR) * 100 : (currentMRR > 0 ? 100 : 0);

            // Count months with monthly fee revenue (in the selected year)
            let monthsActive = 0;
            for (let m = 1; m <= effectiveMonth; m++) {
                if ((data.monthlyFeeRevenue.get(ym(year, m)) || 0) > 0) monthsActive++;
            }

            // Consecutive months from most recent
            let consecutive = 0;
            let expectedYM = currentYM;
            for (let m = effectiveMonth; m >= 1; m--) {
                const key = ym(year, m);
                if (key !== expectedYM) break;
                if ((data.monthlyFeeRevenue.get(key) || 0) > 0) {
                    consecutive++;
                    const pm = m === 1 ? 12 : m - 1;
                    const py = m === 1 ? year - 1 : year;
                    expectedYM = ym(py, pm);
                } else {
                    break;
                }
            }
            // Check baseline month for consecutive streak extending back
            if (consecutive === effectiveMonth && wasInBaseline && baselineMRR > 0) {
                consecutive++; // Baseline Dec counts
            }

            // Products breakdown
            const products = [...data.products.entries()].map(([code, d]) => ({
                code, name: FA_NAMES[code] || code, revenue: d.revenue, count: d.count,
            })).sort((a, b) => b.revenue - a.revenue);

            // Manual events for backward compat
            const clinicManualEvents = manualEventsByName.get(name) || [];

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
                events: clinicManualEvents.map((e: any) => ({
                    type: e.event_type, month: e.year_month, confirmed: e.confirmed,
                })),
                auto_events: autoEvents.map(e => ({
                    type: e.type, month: e.month, is_manual: e.is_manual,
                })),
                monthly_fees: monthlyFees,
                baseline_mrr: baselineMRR,
                was_in_baseline: wasInBaseline,
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

        // ── 6. KPIs ──
        const activeClinics = clinicRows.filter(c => c.status === "active" || c.status === "new");
        const pausedClinics = clinicRows.filter(c => c.status === "paused");
        const churnedClinics = clinicRows.filter(c => c.status === "churned");
        const newClinics = clinicRows.filter(c => c.status === "new");

        const totalMRR = activeClinics.reduce((sum, c) => sum + c.current_mrr, 0);
        const avgMRR = activeClinics.length > 0 ? totalMRR / activeClinics.length : 0;
        const totalRevenueYTD = clinicRows.reduce((sum, c) => sum + c.total_revenue_ytd, 0);

        const churnRate = (activeClinics.length + churnedClinics.length) > 0
            ? (churnedClinics.length / (activeClinics.length + churnedClinics.length)) * 100
            : 0;

        // ── 7. Monthly timeline (using auto-detected + manual events) ──
        const timeline: { month: string; new: number; churn: number; pause: number; return: number; active_count: number; mrr: number }[] = [];
        for (let m = 1; m <= effectiveMonth; m++) {
            const ymKey = ym(year, m);
            const tl = timelineAutoEvents.get(ymKey) || { new: 0, churn: 0, pause: 0, return: 0 };

            let monthMRR = 0;
            let monthActiveCount = 0;
            for (const [, d] of clinicMap) {
                const rev = d.monthlyFeeRevenue.get(ymKey) || 0;
                if (rev > 0) { monthActiveCount++; monthMRR += rev; }
            }

            timeline.push({
                month: ymKey,
                new: tl.new,
                churn: tl.churn,
                pause: tl.pause,
                return: tl.return,
                active_count: monthActiveCount,
                mrr: monthMRR,
            });
        }

        return NextResponse.json({
            success: true,
            year,
            month: effectiveMonth,
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
                baseline_clinics_count: baselineRevenue.size,
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
