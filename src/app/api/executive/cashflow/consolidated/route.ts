import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Revenue Cashflow API — Bank-centric reconciled view
// Shows bank inflows broken down by gateway + FA attribution
// ============================================================

interface MonthlyData {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

const emptyMonthly = (): MonthlyData => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
});

const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

// FA account hierarchy
const REVENUE_GROUPS: { code: string; name: string; children: { code: string; name: string }[] }[] = [
    {
        code: "101.0", name: "Growth",
        children: [
            { code: "101.1", name: "DSD Courses" },
            { code: "101.2", name: "Others Courses" },
            { code: "101.3", name: "Mastership" },
            { code: "101.4", name: "PC Membership" },
            { code: "101.5", name: "Partnerships" },
        ],
    },
    {
        code: "102.0", name: "Delight (Clinics)",
        children: [
            { code: "102.1", name: "Contracted ROW" },
            { code: "102.2", name: "Contracted AMEX" },
            { code: "102.3", name: "Level 3 New ROW" },
            { code: "102.4", name: "Level 3 New AMEX" },
            { code: "102.5", name: "Consultancies" },
            { code: "102.6", name: "Marketing Coaching" },
            { code: "102.7", name: "Others" },
        ],
    },
    {
        code: "103.0", name: "Planning Center",
        children: [
            { code: "103.1", name: "Level 3 ROW" },
            { code: "103.2", name: "Level 3 AMEX" },
            { code: "103.3", name: "Level 3 New ROW" },
            { code: "103.4", name: "Level 3 New AMEX" },
            { code: "103.5", name: "Level 2" },
            { code: "103.6", name: "Level 1" },
            { code: "103.7", name: "Not a Subscriber" },
        ],
    },
    {
        code: "104.0", name: "LAB",
        children: [
            { code: "104.1", name: "Level 3 ROW" },
            { code: "104.2", name: "Level 3 AMEX" },
            { code: "104.3", name: "Level 3 New ROW" },
            { code: "104.4", name: "Level 3 New AMEX" },
            { code: "104.5", name: "Level 2" },
            { code: "104.6", name: "Level 1" },
            { code: "104.7", name: "Not a Subscriber" },
        ],
    },
    {
        code: "105.0", name: "Other Income",
        children: [
            { code: "105.1", name: "Level 1 Subscriptions" },
            { code: "105.2", name: "CORE Partnerships" },
            { code: "105.3", name: "Study Club" },
            { code: "105.4", name: "Other Marketing Rev" },
        ],
    },
];

function parseAmount(value: unknown): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value);
    if (str.includes(",") && str.includes(".")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(str.replace(",", ".")) || 0;
}

const PAGE_SIZE = 1000;

async function fetchAllRows(
    source: string,
    startDate: string,
    endDate: string,
    fields = "date, amount, reconciled, custom_data",
) {
    const rows: any[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabaseAdmin
            .from("csv_rows")
            .select(fields)
            .eq("source", source)
            .gte("date", startDate)
            .lte("date", endDate)
            .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }
    return rows;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    try {
        // Parallel fetch: all bank rows + invoice orders
        const [bankinterEurRows, bankinterUsdRows, sabadellRows, chaseUsdRows, invoiceRows] = await Promise.all([
            fetchAllRows("bankinter-eur", startDate, endDate),
            fetchAllRows("bankinter-usd", startDate, endDate),
            fetchAllRows("sabadell", startDate, endDate),
            fetchAllRows("chase-usd", startDate, endDate),
            fetchAllRows("invoice-orders", startDate, endDate, "date, amount, custom_data"),
        ]);

        // Combine all bank rows with bank identifier
        const allBankRows = [
            ...bankinterEurRows.map(r => ({ ...r, bank: "Bankinter EUR" })),
            ...bankinterUsdRows.map(r => ({ ...r, bank: "Bankinter USD" })),
            ...sabadellRows.map(r => ({ ...r, bank: "Sabadell EUR" })),
            ...chaseUsdRows.map(r => ({ ...r, bank: "Chase 9186" })),
        ];

        // ═══════════════════════════════════════════════════
        // SECTION 1: Bank Inflows Breakdown by Gateway
        // ═══════════════════════════════════════════════════
        const bankInflows = emptyMonthly();
        const bankOutflows = emptyMonthly();
        const bankNet = emptyMonthly();
        const reconByGateway: Record<string, { monthly: MonthlyData; count: number }> = {};
        const unreconciledInflows = emptyMonthly();
        const reconciledInflows = emptyMonthly();

        const normalizeGateway = (src: string): string => {
            const lower = (src || "").toLowerCase();
            if (lower.includes("braintree")) return "Braintree";
            if (lower.includes("stripe")) return "Stripe";
            if (lower.includes("gocardless") || lower.includes("go cardless")) return "GoCardless";
            if (lower.includes("quickbooks")) return "QuickBooks";
            return src || "Other";
        };

        let totalBankRowCount = 0;
        let reconciledCount = 0;

        // Per-bank breakdown
        const bankBreakdown: Record<string, { inflows: MonthlyData; outflows: MonthlyData; net: MonthlyData; reconciledInflows: MonthlyData; count: number; reconciledCount: number }> = {};

        for (const row of allBankRows) {
            const amount = parseAmount(row.amount);
            const monthIdx = new Date(row.date).getMonth();
            if (monthIdx < 0 || monthIdx > 11) continue;
            const mk = monthKeys[monthIdx];
            const bankName = row.bank || "Unknown";

            // Initialize bank breakdown
            if (!bankBreakdown[bankName]) {
                bankBreakdown[bankName] = {
                    inflows: emptyMonthly(),
                    outflows: emptyMonthly(),
                    net: emptyMonthly(),
                    reconciledInflows: emptyMonthly(),
                    count: 0,
                    reconciledCount: 0,
                };
            }
            const bb = bankBreakdown[bankName];
            bb.count++;

            totalBankRowCount++;
            bankNet[mk] += amount;
            bb.net[mk] += amount;

            totalBankRowCount++;
            bankNet[mk] += amount;

            if (amount > 0) {
                bankInflows[mk] += amount;
                bb.inflows[mk] += amount;

                if (row.reconciled && row.custom_data?.paymentSource) {
                    const gw = normalizeGateway(row.custom_data.paymentSource);
                    if (!reconByGateway[gw]) {
                        reconByGateway[gw] = { monthly: emptyMonthly(), count: 0 };
                    }
                    reconByGateway[gw].monthly[mk] += amount;
                    reconByGateway[gw].count++;
                    reconciledInflows[mk] += amount;
                    bb.reconciledInflows[mk] += amount;
                    reconciledCount++;
                    bb.reconciledCount++;
                } else {
                    unreconciledInflows[mk] += amount;
                }
            } else {
                bankOutflows[mk] += amount;
                bb.outflows[mk] += amount;
            }
        }

        // Reconciliation percentage per month
        const reconPct = emptyMonthly();
        for (const mk of monthKeys) {
            reconPct[mk] = bankInflows[mk] > 0
                ? Math.round((reconciledInflows[mk] / bankInflows[mk]) * 100)
                : 0;
        }

        // Sort gateways by total desc
        const gatewaySorted = Object.entries(reconByGateway)
            .map(([name, data]) => ({
                name,
                monthly: data.monthly,
                count: data.count,
                total: monthKeys.reduce((s, k) => s + data.monthly[k], 0),
            }))
            .sort((a, b) => b.total - a.total);

        // ═══════════════════════════════════════════════════
        // SECTION 2: Revenue by Financial Account
        // ═══════════════════════════════════════════════════
        const byFA: Record<string, MonthlyData> = {};
        for (const group of REVENUE_GROUPS) {
            for (const child of group.children) {
                byFA[child.code] = emptyMonthly();
            }
        }

        let invoiceCount = 0;
        for (const row of invoiceRows) {
            const fa = String(row.custom_data?.financial_account_code || "").trim();
            if (!fa) continue;
            const monthIdx = new Date(row.date).getMonth();
            if (monthIdx < 0 || monthIdx > 11) continue;
            const amount = parseAmount(row.amount);
            if (amount === 0) continue;

            if (!byFA[fa]) byFA[fa] = emptyMonthly();
            byFA[fa][monthKeys[monthIdx]] += amount;
            invoiceCount++;
        }

        const revenueGroups = REVENUE_GROUPS.map(group => {
            const groupMonthly = emptyMonthly();
            const children = group.children
                .map(child => {
                    const monthly = byFA[child.code] || emptyMonthly();
                    for (const mk of monthKeys) groupMonthly[mk] += monthly[mk];
                    return { code: child.code, name: child.name, monthly };
                })
                .filter(c => monthKeys.some(mk => c.monthly[mk] !== 0));

            const parentData = byFA[group.code];
            if (parentData && monthKeys.some(mk => parentData[mk] !== 0)) {
                children.push({ code: group.code, name: "Unclassified", monthly: parentData });
                for (const mk of monthKeys) groupMonthly[mk] += parentData[mk];
            }

            return { code: group.code, name: group.name, monthly: groupMonthly, children };
        });

        const totalRevenue = emptyMonthly();
        for (const g of revenueGroups) {
            for (const mk of monthKeys) totalRevenue[mk] += g.monthly[mk];
        }

        // ═══════════════════════════════════════════════════
        // Summary
        // ═══════════════════════════════════════════════════
        const sumM = (m: MonthlyData) => monthKeys.reduce((s, k) => s + m[k], 0);
        const totalInflowsSum = sumM(bankInflows);
        const totalReconSum = sumM(reconciledInflows);

        // Bank breakdown sorted by total inflows
        const bankSorted = Object.entries(bankBreakdown)
            .map(([name, data]) => ({
                name,
                inflows: data.inflows,
                outflows: data.outflows,
                net: data.net,
                reconciledInflows: data.reconciledInflows,
                count: data.count,
                reconciledCount: data.reconciledCount,
                totalInflows: monthKeys.reduce((s, k) => s + data.inflows[k], 0),
                totalOutflows: monthKeys.reduce((s, k) => s + data.outflows[k], 0),
            }))
            .sort((a, b) => b.totalInflows - a.totalInflows);

        return NextResponse.json({
            success: true,
            year,
            summary: {
                totalInflows: totalInflowsSum,
                totalOutflows: sumM(bankOutflows),
                netFlow: sumM(bankNet),
                reconciledAmount: totalReconSum,
                reconciledPct: totalInflowsSum > 0 ? Math.round((totalReconSum / totalInflowsSum) * 100) : 0,
                totalRevenueInvoiced: sumM(totalRevenue),
                bankRowCount: totalBankRowCount,
                reconciledRowCount: reconciledCount,
                invoiceCount,
            },
            bank: {
                inflows: bankInflows,
                outflows: bankOutflows,
                net: bankNet,
                reconciledInflows,
                unreconciledInflows,
                reconPct,
                gateways: gatewaySorted,
                byBank: bankSorted,
            },
            revenue: {
                groups: revenueGroups,
                total: totalRevenue,
            },
        });
    } catch (err: any) {
        console.error("Revenue cashflow API error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 },
        );
    }
}
