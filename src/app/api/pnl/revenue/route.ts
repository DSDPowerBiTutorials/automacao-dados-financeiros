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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Buscar todos os dados de receita (HubSpot + Invoice Orders + outras fontes)
        // IMPORTANTE: usar range para pegar todos os registros (limite padrão é 1000)
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("source, date, amount, custom_data")
                .gte("date", startDate)
                .lte("date", endDate)
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Erro ao buscar dados:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            offset += pageSize;

            // Se retornou menos que o pageSize, não há mais dados
            if (data.length < pageSize) break;
        }

        console.log(`📊 Total de registros carregados: ${allData.length}`);

        // Fonte de receita: apenas Invoice Orders
        const revenueSources = ["invoice-orders"];

        // Total mensal Invoice Orders
        const invoiceOrdersRevenue: MonthlyData = emptyMonthly();
        const invoiceOrdersCount: MonthlyData = emptyMonthly();

        // Por Financial Account (dados reais) - TODOS os códigos usados pelo P&L
        const byFinancialAccount: { [key: string]: MonthlyData } = {
            // 101.0 Growth
            "101.1": emptyMonthly(), // DSD Courses
            "101.2": emptyMonthly(), // Others Courses
            "101.3": emptyMonthly(), // Mastership
            "101.4": emptyMonthly(), // PC Membership
            "101.5": emptyMonthly(), // Partnerships
            "101.6": emptyMonthly(), // Level 2 Allocation
            // 102.0 Delight
            "102.1": emptyMonthly(), // Contracted ROW
            "102.2": emptyMonthly(), // Contracted AMEX
            "102.3": emptyMonthly(), // Level 3 New ROW
            "102.4": emptyMonthly(), // Level 3 New AMEX
            "102.5": emptyMonthly(), // Consultancies
            "102.6": emptyMonthly(), // Marketing Coaching
            "102.7": emptyMonthly(), // Others
            // 103.0 Planning Center
            "103.0": emptyMonthly(),
            "103.1": emptyMonthly(), // Level 3 ROW
            "103.2": emptyMonthly(), // Level 3 AMEX
            "103.3": emptyMonthly(), // Level 3 New ROW
            "103.4": emptyMonthly(), // Level 3 New AMEX
            "103.5": emptyMonthly(), // Level 2
            "103.6": emptyMonthly(), // Level 1
            "103.7": emptyMonthly(), // Not a Subscriber
            "103.8": emptyMonthly(), // Level 2 Allocation
            "103.9": emptyMonthly(), // Level 3 Allocation
            // 104.0 LAB
            "104.0": emptyMonthly(),
            "104.1": emptyMonthly(), // Level 3 ROW
            "104.2": emptyMonthly(), // Level 3 AMEX
            "104.3": emptyMonthly(), // Level 3 New ROW
            "104.4": emptyMonthly(), // Level 3 New AMEX
            "104.5": emptyMonthly(), // Level 2
            "104.6": emptyMonthly(), // Level 1
            "104.7": emptyMonthly(), // Not a Subscriber
            // 105.0 Other Income
            "105.1": emptyMonthly(), // Level 1 Subscriptions
            "105.2": emptyMonthly(), // Other
            "105.4": emptyMonthly(), // Other Marketing
        };

        const byFinancialAccountCount: { [key: string]: MonthlyData } = {};
        for (const fa of Object.keys(byFinancialAccount)) {
            byFinancialAccountCount[fa] = emptyMonthly();
        }

        // Total por mês (todas as receitas)
        const totalRevenue: MonthlyData = emptyMonthly();

        for (const row of allData || []) {
            if (!row.date || !row.source) continue;

            // Apenas receitas positivas
            const amount = row.amount || 0;
            if (amount < 0) continue;

            const monthIndex = new Date(row.date).getMonth();
            const monthKey = monthKeys[monthIndex];

            // Apenas fontes de receita
            if (!revenueSources.includes(row.source)) continue;

            // Invoice Orders
            if (row.source === "invoice-orders") {
                invoiceOrdersRevenue[monthKey] += amount;
                invoiceOrdersCount[monthKey]++;
            }

            // Por Financial Account
            const fa = row.custom_data?.financial_account_code;
            if (fa && byFinancialAccount[fa]) {
                byFinancialAccount[fa][monthKey] += amount;
                byFinancialAccountCount[fa][monthKey]++;
            }

            // Total geral
            totalRevenue[monthKey] += amount;
        }

        console.log(`📊 P&L API - Ano ${year}:`, {
            invoiceOrders: invoiceOrdersRevenue,
            totalRevenue,
            financialAccounts: Object.keys(byFinancialAccount).map(fa => ({
                fa,
                total: Object.values(byFinancialAccount[fa]).reduce((a, b) => a + b, 0)
            }))
        });

        return NextResponse.json({
            success: true,
            year,
            invoiceOrders: {
                revenue: invoiceOrdersRevenue,
                count: invoiceOrdersCount,
            },
            totalRevenue,
            byFinancialAccount,
            byFinancialAccountCount,
            totalRecords: allData?.length || 0,
        });
    } catch (error) {
        console.error("Erro na API de receita:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar dados de receita" },
            { status: 500 }
        );
    }
}
