import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface MonthlyData {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

const emptyMonthly = (): MonthlyData => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
});

const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

// Explicit FA code lists — MUST match P&L APIs exactly
const ALL_REVENUE_FA_CODES = [
    "101.1", "101.2", "101.3", "101.4", "101.5",
    "102.1", "102.2", "102.3", "102.4", "102.5", "102.6", "102.7",
    "103.1", "103.2", "103.3", "103.4", "103.5", "103.6", "103.7",
    "104.1", "104.2", "104.3", "104.4", "104.5", "104.6", "104.7",
    "105.1", "105.2", "105.3", "105.4",
];

const ALL_EXPENSE_FA_CODES = [
    "201.1", "201.2", "201.3", "201.4", "201.5", "201.6",
    "202.1", "202.2", "202.3", "202.4", "202.5", "202.6", "202.7", "202.8",
    "203.1", "203.2", "203.3", "203.4", "203.5", "203.6", "203.7",
    "204.1", "204.2",
    "205.0",
    "206.1", "206.1.1", "206.2", "206.2.2",
    "207.0",
    "208.0",
    "209.0",
    "210.0",
    "211.0",
    "300.0",
];

const REVENUE_FA_SET = new Set(ALL_REVENUE_FA_CODES);
const EXPENSE_FA_SET = new Set(ALL_EXPENSE_FA_CODES);

// Revenue FA codes grouped by parent
const REVENUE_PREFIXES = ["101", "102", "103", "104", "105"];
// Expense FA codes grouped by parent
const EXPENSE_PREFIXES = ["201", "202", "203", "204", "205", "206", "207", "208", "209", "210", "211", "300"];

const CANCELLED_STATUSES = ["cancelled", "refunded", "expired", "canceled"];

function sumMonthly(data: MonthlyData): number {
    return Object.values(data).reduce((a, b) => a + b, 0);
}

function addMonthly(target: MonthlyData, source: MonthlyData): void {
    for (const mk of monthKeys) {
        target[mk] += source[mk];
    }
}

function aggregateByParent(byAccount: Record<string, MonthlyData>, prefixes: string[]): Record<string, MonthlyData> {
    const result: Record<string, MonthlyData> = {};
    for (const prefix of prefixes) {
        result[prefix] = emptyMonthly();
    }
    for (const [fa, monthly] of Object.entries(byAccount)) {
        const parent = fa.split(".")[0];
        if (result[parent]) {
            addMonthly(result[parent], monthly);
        }
    }
    return result;
}

async function fetchAllPaginated(
    queryBuilder: () => ReturnType<ReturnType<typeof supabaseAdmin.from>["select"]>,
    pageSize = 1000
) {
    let allData: any[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await queryBuilder().range(offset, offset + pageSize - 1) as any;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        offset += pageSize;
        if (data.length < pageSize) break;
    }
    return allData;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();
        const scope = searchParams.get("scope") || null;

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // --- REVENUE (from csv_rows / invoice-orders) ---
        // Pre-initialize ONLY recognized FA codes (same as P&L revenue API)
        const revenueByFA: Record<string, MonthlyData> = {};
        for (const fa of ALL_REVENUE_FA_CODES) {
            revenueByFA[fa] = emptyMonthly();
        }

        let revenueOffset = 0;
        const pageSize = 1000;
        while (true) {
            let query = supabaseAdmin
                .from("csv_rows")
                .select("date, amount, custom_data")
                .gte("date", startDate)
                .lte("date", endDate)
                .range(revenueOffset, revenueOffset + pageSize - 1);

            if (scope === "ES") {
                query = query.eq("source", "invoice-orders");
            } else if (scope === "US") {
                query = query.eq("source", "invoice-orders-usd");
            } else {
                query = query.in("source", ["invoice-orders", "invoice-orders-usd"]);
            }

            const { data, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            if (!data || data.length === 0) break;

            for (const row of data) {
                if (!row.date) continue;
                const orderStatus = ((row.custom_data as any)?.order_status || "").toString().toLowerCase();
                if (orderStatus && CANCELLED_STATUSES.includes(orderStatus)) continue;
                const amount = row.amount || 0;
                if (amount === 0) continue;

                const monthIndex = parseInt(row.date.substring(5, 7), 10) - 1;
                const mk = monthKeys[monthIndex];

                const fa = (row.custom_data as any)?.financial_account_code;
                // Only count rows with recognized FA codes (same as P&L)
                if (!fa || !REVENUE_FA_SET.has(fa)) continue;
                revenueByFA[fa][mk] += amount;
            }

            revenueOffset += pageSize;
            if (data.length < pageSize) break;
        }

        // --- EXPENSES (from invoices with dre_impact = true) ---
        // Pre-initialize ONLY recognized FA codes (same as P&L expenses API)
        const expenseByFA: Record<string, MonthlyData> = {};
        for (const fa of ALL_EXPENSE_FA_CODES) {
            expenseByFA[fa] = emptyMonthly();
        }

        let expOffset = 0;
        while (true) {
            let query = supabaseAdmin
                .from("invoices")
                .select("benefit_date, invoice_amount, financial_account_code, invoice_type")
                .eq("dre_impact", true)
                .gte("benefit_date", startDate)
                .lte("benefit_date", endDate)
                .range(expOffset, expOffset + pageSize - 1);

            if (scope === "ES" || scope === "US") {
                query = query.eq("scope", scope);
            }

            const { data, error } = await query;
            if (error) return NextResponse.json({ error: error.message }, { status: 500 });
            if (!data || data.length === 0) break;

            for (const row of data) {
                if (!row.benefit_date || !row.financial_account_code) continue;
                if ((row.invoice_type as string) === "BUDGET") continue; // Skip budget, actuals only

                const amount = row.invoice_amount || 0;
                if (amount === 0) continue;

                const monthIndex = parseInt(row.benefit_date.substring(5, 7), 10) - 1;
                if (monthIndex < 0 || monthIndex > 11) continue;
                const mk = monthKeys[monthIndex];

                const rawFA = row.financial_account_code as string;
                let fa = rawFA.includes(" - ") ? rawFA.split(" - ")[0].trim() : rawFA;
                if (fa === "0000" || fa === "400.0") continue;
                if (fa === "209.1" || fa === "209.2") fa = "209.0";

                // Only count rows with recognized FA codes (same as P&L)
                if (!EXPENSE_FA_SET.has(fa)) continue;
                expenseByFA[fa][mk] += amount;
            }

            expOffset += pageSize;
            if (data.length < pageSize) break;
        }

        // Aggregate by parent code (101, 102, etc.)
        const revenueByParent = aggregateByParent(revenueByFA, REVENUE_PREFIXES);
        const expenseByParent = aggregateByParent(expenseByFA, EXPENSE_PREFIXES);

        // Calculate totals FROM aggregated recognized accounts (not raw row sums)
        const revenueMonthly = emptyMonthly();
        for (const p of REVENUE_PREFIXES) {
            addMonthly(revenueMonthly, revenueByParent[p]);
        }
        const expenseMonthly = emptyMonthly();
        for (const p of EXPENSE_PREFIXES) {
            addMonthly(expenseMonthly, expenseByParent[p]);
        }

        const totalRev = sumMonthly(revenueMonthly);
        const totalExp = sumMonthly(expenseMonthly);
        const grossProfit = totalRev - totalExp;

        return NextResponse.json({
            success: true,
            year,
            revenue: {
                monthly: revenueMonthly,
                byAccount: revenueByParent,
                total: totalRev,
            },
            expenses: {
                monthly: expenseMonthly,
                byAccount: expenseByParent,
                total: totalExp,
            },
            kpis: {
                totalRevenue: totalRev,
                totalExpenses: totalExp,
                grossProfit,
                netMargin: totalRev > 0 ? (grossProfit / totalRev) * 100 : 0,
            },
        });
    } catch (error) {
        console.error("Error in BI summary API:", error);
        return NextResponse.json(
            { error: "Internal error fetching BI data" },
            { status: 500 }
        );
    }
}
