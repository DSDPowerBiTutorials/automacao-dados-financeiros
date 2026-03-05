import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Sales Insights → Lab Analysis API
// Aggregates LAB department data from csv_rows (invoice-orders)
// FA codes 104.x only
// ============================================================

const LAB_FA_PREFIX = "104.";

const FA_NAMES: Record<string, string> = {
    "104.1": "Level 3 ROW",
    "104.2": "Level 3 AMEX",
    "104.3": "Level 3 New ROW",
    "104.4": "Level 3 New AMEX",
    "104.5": "Level 2",
    "104.6": "Level 1",
    "104.7": "Not a Subscriber",
};

// Region mapping: .1/.3 = ROW, .2/.4 = AMEX, rest = Other
function getRegion(fa: string): string {
    if (["104.1", "104.3"].includes(fa)) return "ROW";
    if (["104.2", "104.4"].includes(fa)) return "AMEX";
    return "Other";
}

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
    const region = searchParams.get("region") || "all"; // ROW, AMEX, Other, all

    try {
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year}-12-31`;
        const currentYM = `${year}-${String(month).padStart(2, "0")}`;
        const currentMonthStart = `${currentYM}-01`;
        const currentMonthEnd = getLastDayOfMonth(year, month);

        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        const prevYM = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
        const prevMonthStart = `${prevYM}-01`;
        const prevMonthEnd = getLastDayOfMonth(prevYear, prevMonth);

        // Fetch year data paged
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

        // Fetch prev month if different year
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

        // Filter LAB FA codes (104.x)
        const isLabFA = (fa: string) => fa.startsWith(LAB_FA_PREFIX);

        const labTx = allYearTx.filter(tx => {
            const fa = tx.custom_data?.financial_account_code || "";
            return isLabFA(fa);
        });

        // Add prev year month data
        if (prevYear < year) {
            const prevLabTx = prevMonthTx.filter(tx => {
                const fa = tx.custom_data?.financial_account_code || "";
                return isLabFA(fa);
            });
            labTx.push(...prevLabTx);
        }

        // ── Build per-client aggregation ──
        interface ClientData {
            name: string;
            email: string;
            region: string;
            monthlyRevenue: Map<string, number>;
            products: Map<string, { revenue: number; count: number }>;
            totalRevenue: number;
            firstDate: string;
            lastDate: string;
            txCount: number;
        }

        const clientMap = new Map<string, ClientData>();

        // Also build per-product and per-month totals
        const productMonthly = new Map<string, Map<string, number>>(); // FA code → (YM → revenue)
        const monthlyTotals = new Map<string, { revenue: number; orders: number; clients: Set<string> }>();

        for (const tx of labTx) {
            const cd = tx.custom_data || {};
            const customerName = String(cd.customer_name || "").trim();
            if (!customerName) continue;

            const fa = String(cd.financial_account_code || "").trim();
            if (!fa || !isLabFA(fa)) continue;

            const txRegion = getRegion(fa);
            if (region !== "all" && txRegion !== region) continue;

            const amount = parseEuropeanNumber(tx.amount);
            const date = tx.date || "";
            const ym = date.substring(0, 7);
            const email = String(cd.email || "").trim().toLowerCase();

            // Client aggregation
            let client = clientMap.get(customerName);
            if (!client) {
                client = {
                    name: customerName,
                    email,
                    region: txRegion,
                    monthlyRevenue: new Map(),
                    products: new Map(),
                    totalRevenue: 0,
                    firstDate: date,
                    lastDate: date,
                    txCount: 0,
                };
                clientMap.set(customerName, client);
            }
            if (!client.email && email) client.email = email;

            client.monthlyRevenue.set(ym, (client.monthlyRevenue.get(ym) || 0) + amount);
            const prod = client.products.get(fa) || { revenue: 0, count: 0 };
            prod.revenue += amount;
            prod.count += 1;
            client.products.set(fa, prod);
            client.totalRevenue += amount;
            client.txCount += 1;
            if (date < client.firstDate) client.firstDate = date;
            if (date > client.lastDate) client.lastDate = date;

            // Product monthly
            if (!productMonthly.has(fa)) productMonthly.set(fa, new Map());
            const pm = productMonthly.get(fa)!;
            pm.set(ym, (pm.get(ym) || 0) + amount);

            // Monthly totals
            if (!monthlyTotals.has(ym)) monthlyTotals.set(ym, { revenue: 0, orders: 0, clients: new Set() });
            const mt = monthlyTotals.get(ym)!;
            mt.revenue += amount;
            mt.orders += 1;
            mt.clients.add(customerName);
        }

        // ── Build client rows ──
        interface LabClient {
            name: string;
            email: string;
            region: string;
            revenue_current: number;
            revenue_previous: number;
            revenue_change: number;
            revenue_change_pct: number;
            revenue_ytd: number;
            order_count: number;
            avg_ticket: number;
            first_date: string;
            last_date: string;
            products: { code: string; name: string; revenue: number; count: number }[];
            months_active: number;
        }

        const clients: LabClient[] = [];

        for (const [name, data] of clientMap) {
            const revCurrent = data.monthlyRevenue.get(currentYM) || 0;
            const revPrevious = data.monthlyRevenue.get(prevYM) || 0;
            const revChange = revCurrent - revPrevious;
            const revChangePct = revPrevious > 0 ? (revChange / revPrevious) * 100 : (revCurrent > 0 ? 100 : 0);

            const products = [...data.products.entries()].map(([code, d]) => ({
                code,
                name: FA_NAMES[code] || code,
                revenue: d.revenue,
                count: d.count,
            })).sort((a, b) => b.revenue - a.revenue);

            clients.push({
                name,
                email: data.email,
                region: data.region,
                revenue_current: revCurrent,
                revenue_previous: revPrevious,
                revenue_change: revChange,
                revenue_change_pct: revChangePct,
                revenue_ytd: data.totalRevenue,
                order_count: data.txCount,
                avg_ticket: data.txCount > 0 ? data.totalRevenue / data.txCount : 0,
                first_date: data.firstDate,
                last_date: data.lastDate,
                products,
                months_active: data.monthlyRevenue.size,
            });
        }

        // Sort by YTD revenue desc
        clients.sort((a, b) => b.revenue_ytd - a.revenue_ytd);

        // ── Product breakdown ──
        interface ProductBreakdown {
            code: string;
            name: string;
            revenue_ytd: number;
            revenue_current: number;
            revenue_previous: number;
            change_pct: number;
            order_count: number;
            pct_of_total: number;
        }

        const totalRevenueYTD = clients.reduce((sum, c) => sum + c.revenue_ytd, 0);

        const productBreakdown: ProductBreakdown[] = [];
        for (const [fa, monthMap] of productMonthly) {
            let ytd = 0;
            let count = 0;
            for (const [, rev] of monthMap) { ytd += rev; }
            // Count orders for this FA code
            for (const [, data] of clientMap) {
                const p = data.products.get(fa);
                if (p) count += p.count;
            }
            const current = monthMap.get(currentYM) || 0;
            const previous = monthMap.get(prevYM) || 0;
            const changePct = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);

            productBreakdown.push({
                code: fa,
                name: FA_NAMES[fa] || fa,
                revenue_ytd: ytd,
                revenue_current: current,
                revenue_previous: previous,
                change_pct: changePct,
                order_count: count,
                pct_of_total: totalRevenueYTD > 0 ? (ytd / totalRevenueYTD) * 100 : 0,
            });
        }
        productBreakdown.sort((a, b) => b.revenue_ytd - a.revenue_ytd);

        // ── Monthly timeline ──
        interface TimelineEntry {
            month: string;
            revenue: number;
            orders: number;
            active_clients: number;
            avg_ticket: number;
        }

        const timeline: TimelineEntry[] = [];
        for (let m = 1; m <= month; m++) {
            const ym = `${year}-${String(m).padStart(2, "0")}`;
            const mt = monthlyTotals.get(ym);
            const rev = mt?.revenue || 0;
            const orders = mt?.orders || 0;
            timeline.push({
                month: ym,
                revenue: rev,
                orders,
                active_clients: mt?.clients.size || 0,
                avg_ticket: orders > 0 ? rev / orders : 0,
            });
        }

        // ── KPIs ──
        const currentMonthData = monthlyTotals.get(currentYM);
        const prevMonthData = monthlyTotals.get(prevYM);
        const revenueThisMonth = currentMonthData?.revenue || 0;
        const revenuePrevMonth = prevMonthData?.revenue || 0;
        const momGrowth = revenuePrevMonth > 0
            ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100
            : (revenueThisMonth > 0 ? 100 : 0);

        const activeClientsThisMonth = currentMonthData?.clients.size || 0;
        const totalOrders = clients.reduce((sum, c) => sum + c.order_count, 0);
        const avgTicket = totalOrders > 0 ? totalRevenueYTD / totalOrders : 0;

        return NextResponse.json({
            success: true,
            year,
            month,
            region,
            kpis: {
                revenue_this_month: revenueThisMonth,
                revenue_prev_month: revenuePrevMonth,
                revenue_ytd: totalRevenueYTD,
                active_clients: activeClientsThisMonth,
                total_clients: clients.length,
                total_orders: totalOrders,
                avg_ticket: avgTicket,
                mom_growth: momGrowth,
            },
            clients,
            product_breakdown: productBreakdown,
            timeline,
        });
    } catch (err: any) {
        console.error("Lab overview API error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
