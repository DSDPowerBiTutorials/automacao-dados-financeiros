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

// All expense FA codes used in the P&L structure
const ALL_EXPENSE_FA_CODES = [
    // 201 - COGS
    "201.1", "201.2", "201.3", "201.4", "201.5",
    // 202 - Labour
    "202.1", "202.2", "202.3", "202.4", "202.5", "202.6", "202.7",
    // 203 - Travels & Meals
    "203.1", "203.2", "203.3", "203.4", "203.5", "203.6", "203.7",
    // 204 - Professional Fees
    "204.1", "204.2",
    // 205 - Marketing and Advertising
    "205.0",
    // 206 - Office
    "206.1", "206.1.1", "206.2",
    // 207 - Information Technology
    "207.0",
    // 208 - Research and Development
    "208.0",
    // 209 - Bank and Financial Fees
    "209.1", "209.2",
    // 210 - Balance Adjustments
    "210.0",
    // 211 - Amortization & Depreciation
    "211.0",
    // 300 - FX Variation
    "300.0",
    // 400 - Taxes & Other
    "400.0",
    // 0000 - Unassigned
    "0000",
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Fetch all invoices with dre_impact = true for the given year
        // Paginate to avoid 1000 row limit
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("invoices")
                .select("benefit_date, invoice_amount, financial_account_code, invoice_type")
                .eq("dre_impact", true)
                .gte("benefit_date", startDate)
                .lte("benefit_date", endDate)
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching invoices for P&L:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            offset += pageSize;

            if (data.length < pageSize) break;
        }

        console.log(`📊 P&L Expenses API - ${allData.length} invoices loaded for ${year}`);

        // Initialize all FA accounts
        const byExpenseAccount: { [key: string]: MonthlyData } = {};
        const byExpenseBudget: { [key: string]: MonthlyData } = {};

        for (const fa of ALL_EXPENSE_FA_CODES) {
            byExpenseAccount[fa] = emptyMonthly();
            byExpenseBudget[fa] = emptyMonthly();
        }

        // Process each invoice
        let actualCount = 0;
        let budgetCount = 0;

        for (const row of allData) {
            if (!row.benefit_date || !row.financial_account_code) continue;

            const amount = row.invoice_amount || 0;
            if (amount === 0) continue;

            // Extract month from date string "YYYY-MM-DD"
            const monthIndex = parseInt(row.benefit_date.substring(5, 7), 10) - 1;
            if (monthIndex < 0 || monthIndex > 11) continue;
            const monthKey = monthKeys[monthIndex];

            const fa = row.financial_account_code;

            // Map unassigned FA code "0000" → "210.0" (Balance Adjustments)
            const mappedFA = fa === "0000" ? "210.0" : fa;

            if (row.invoice_type === "BUDGET") {
                // Budget data
                if (!byExpenseBudget[mappedFA]) {
                    byExpenseBudget[mappedFA] = emptyMonthly();
                }
                byExpenseBudget[mappedFA][monthKey] += amount;
                budgetCount++;
            } else {
                // INCURRED + ADJUSTMENT → Actual
                if (!byExpenseAccount[mappedFA]) {
                    byExpenseAccount[mappedFA] = emptyMonthly();
                }
                byExpenseAccount[mappedFA][monthKey] += amount;
                actualCount++;
            }
        }

        // Log category totals for debugging
        const categoryTotals: { [key: string]: number } = {};
        const categoryBudgetTotals: { [key: string]: number } = {};
        for (const fa of ALL_EXPENSE_FA_CODES) {
            const cat = fa.split(".")[0] + ".0";
            const total = Object.values(byExpenseAccount[fa] || emptyMonthly()).reduce((a, b) => a + b, 0);
            const budgetTotal = Object.values(byExpenseBudget[fa] || emptyMonthly()).reduce((a, b) => a + b, 0);
            categoryTotals[cat] = (categoryTotals[cat] || 0) + total;
            categoryBudgetTotals[cat] = (categoryBudgetTotals[cat] || 0) + budgetTotal;
        }

        console.log(`📊 P&L Expenses - Actual: ${actualCount}, Budget: ${budgetCount}`);
        console.log(`📊 Category totals (actual):`, categoryTotals);
        console.log(`📊 Category totals (budget):`, categoryBudgetTotals);

        return NextResponse.json({
            success: true,
            year,
            byExpenseAccount,
            byExpenseBudget,
            totalRecords: allData.length,
            actualCount,
            budgetCount,
            categoryTotals,
            categoryBudgetTotals,
        });
    } catch (error) {
        console.error("Error in expenses P&L API:", error);
        return NextResponse.json(
            { error: "Internal error fetching expense data" },
            { status: 500 }
        );
    }
}
