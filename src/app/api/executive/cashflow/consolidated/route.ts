import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Consolidated Cashflow API
// Section 1: Revenue by Financial Account per month (from invoice-orders)
// Section 2: Cash Inflow by Payment Source per month (from gateway sources)
// Section 3: Bank Statement Inflows per month (from bank sources)
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

// FA account hierarchy for revenue
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

// Payment/gateway source labels
const GATEWAY_SOURCES: { source: string; label: string; currency: string }[] = [
    { source: "braintree-api-revenue", label: "Braintree", currency: "multi" },
    { source: "stripe-eur", label: "Stripe EUR", currency: "EUR" },
    { source: "stripe-usd", label: "Stripe USD", currency: "USD" },
    { source: "gocardless", label: "GoCardless", currency: "EUR" },
    { source: "quickbooks-payments", label: "QuickBooks Payments", currency: "USD" },
];

// Bank account sources
const BANK_SOURCES: { source: string; label: string; currency: string }[] = [
    { source: "bankinter-eur", label: "Bankinter EUR", currency: "EUR" },
    { source: "bankinter-usd", label: "Bankinter USD", currency: "USD" },
    { source: "sabadell-eur", label: "Sabadell EUR", currency: "EUR" },
];

function parseAmount(value: unknown): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const str = String(value);
    // Handle European format (dots = thousands, comma = decimal)
    if (str.includes(",") && str.includes(".")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(str.replace(",", ".")) || 0;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    try {
        // ═══════════════════════════════════════════════════
        // SECTION 1: Revenue by Financial Account
        // Source: invoice-orders
        // ═══════════════════════════════════════════════════
        const byFA: Record<string, MonthlyData> = {};
        const allFACodes = new Set<string>();
        for (const group of REVENUE_GROUPS) {
            for (const child of group.children) {
                byFA[child.code] = emptyMonthly();
                allFACodes.add(child.code);
            }
        }

        let offset = 0;
        const PAGE_SIZE = 1000;
        let totalInvoiceOrders = 0;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("date, amount, custom_data")
                .eq("source", "invoice-orders")
                .gte("date", startDate)
                .lte("date", endDate)
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;

            for (const row of data) {
                const fa = String(row.custom_data?.financial_account_code || "").trim();
                if (!fa) continue;

                const monthIdx = new Date(row.date).getMonth();
                if (monthIdx < 0 || monthIdx > 11) continue;

                const amount = parseAmount(row.amount);
                if (amount === 0) continue;

                // If exact code exists, use it; otherwise try parent code
                if (byFA[fa]) {
                    byFA[fa][monthKeys[monthIdx]] += amount;
                } else {
                    // Try matching parent (e.g., "102.0" catches unclassified 102.x)
                    const prefix = fa.split(".")[0];
                    const parentCode = `${prefix}.0`;
                    // Store in a catch-all for the group
                    if (!byFA[fa]) byFA[fa] = emptyMonthly();
                    byFA[fa][monthKeys[monthIdx]] += amount;
                }
                totalInvoiceOrders++;
            }

            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        // Build revenue structure with totals
        const revenueGroups = REVENUE_GROUPS.map(group => {
            const groupMonthly = emptyMonthly();
            const children = group.children.map(child => {
                const monthly = byFA[child.code] || emptyMonthly();
                for (const mk of monthKeys) {
                    groupMonthly[mk] += monthly[mk];
                }
                return { code: child.code, name: child.name, monthly };
            }).filter(c => {
                // Only include children with data
                return monthKeys.some(mk => c.monthly[mk] !== 0);
            });

            // Check for unclassified entries (e.g., "102.0", "103.0" etc.)
            const parentData = byFA[group.code];
            if (parentData && monthKeys.some(mk => parentData[mk] !== 0)) {
                children.push({ code: group.code, name: "Unclassified", monthly: parentData });
                for (const mk of monthKeys) {
                    groupMonthly[mk] += parentData[mk];
                }
            }

            return { code: group.code, name: group.name, monthly: groupMonthly, children };
        });

        // Total revenue
        const totalRevenue = emptyMonthly();
        for (const g of revenueGroups) {
            for (const mk of monthKeys) {
                totalRevenue[mk] += g.monthly[mk];
            }
        }

        // ═══════════════════════════════════════════════════
        // SECTION 2: Cash Inflow by Gateway/Payment Source
        // SECTION 3: Bank Statement Inflows
        // (parallelized for performance)
        // ═══════════════════════════════════════════════════

        async function fetchSourceMonthly(source: string, startDate: string, endDate: string) {
            const monthly = emptyMonthly();
            const inflows = emptyMonthly();
            const outflows = emptyMonthly();
            let count = 0;
            let srcOffset = 0;
            while (true) {
                const { data, error } = await supabaseAdmin
                    .from("csv_rows")
                    .select("date, amount")
                    .eq("source", source)
                    .gte("date", startDate)
                    .lte("date", endDate)
                    .range(srcOffset, srcOffset + PAGE_SIZE - 1);
                if (error) { console.error(`Error fetching ${source}:`, error); break; }
                if (!data || data.length === 0) break;
                for (const row of data) {
                    const amount = parseAmount(row.amount);
                    const monthIdx = new Date(row.date).getMonth();
                    if (monthIdx < 0 || monthIdx > 11) continue;
                    monthly[monthKeys[monthIdx]] += amount;
                    if (amount > 0) inflows[monthKeys[monthIdx]] += amount;
                    else outflows[monthKeys[monthIdx]] += amount;
                    count++;
                }
                if (data.length < PAGE_SIZE) break;
                srcOffset += PAGE_SIZE;
            }
            return { monthly, inflows, outflows, count };
        }

        // Fetch all gateways & banks in parallel
        const [gatewayResults, bankResults] = await Promise.all([
            Promise.all(GATEWAY_SOURCES.map(async (gw) => {
                const result = await fetchSourceMonthly(gw.source, startDate, endDate);
                return { ...gw, ...result };
            })),
            Promise.all(BANK_SOURCES.map(async (bank) => {
                const result = await fetchSourceMonthly(bank.source, startDate, endDate);
                return { ...bank, ...result };
            })),
        ]);

        // Gateways — only positive amounts (inflows)
        const gateways = gatewayResults
            .filter(gw => gw.count > 0)
            .map(gw => ({ source: gw.source, label: gw.label, currency: gw.currency, monthly: gw.inflows, count: gw.count }));

        // Gateway totals
        const totalGateway = emptyMonthly();
        for (const gw of gateways) {
            for (const mk of monthKeys) {
                totalGateway[mk] += gw.monthly[mk];
            }
        }

        // Banks — full inflows/outflows/net
        const banks = bankResults
            .filter(b => b.count > 0)
            .map(b => ({
                source: b.source, label: b.label, currency: b.currency,
                monthly: b.monthly, inflows: b.inflows, outflows: b.outflows, count: b.count,
            }));

        // Bank totals
        const totalBankInflows = emptyMonthly();
        const totalBankOutflows = emptyMonthly();
        const totalBankNet = emptyMonthly();
        for (const b of banks) {
            for (const mk of monthKeys) {
                totalBankInflows[mk] += b.inflows[mk];
                totalBankOutflows[mk] += b.outflows[mk];
                totalBankNet[mk] += b.monthly[mk];
            }
        }

        return NextResponse.json({
            success: true,
            year,
            revenue: {
                groups: revenueGroups,
                total: totalRevenue,
                invoiceOrdersProcessed: totalInvoiceOrders,
            },
            gateways: {
                sources: gateways,
                total: totalGateway,
            },
            banks: {
                accounts: banks,
                totalInflows: totalBankInflows,
                totalOutflows: totalBankOutflows,
                totalNet: totalBankNet,
            },
        });
    } catch (err: any) {
        console.error("Consolidated cashflow API error:", err);
        return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
        );
    }
}
