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

// Lista de Financial Accounts (sem Allocations - são apenas ajustes internos)
const ALL_FINANCIAL_ACCOUNTS = [
    // 101.0 Growth
    "101.1", // DSD Courses
    "101.2", // Others Courses
    "101.3", // Mastership
    "101.4", // PC Membership
    "101.5", // Partnerships
    // 102.0 Delight (lógica de Clinics: ROW vs AMEX, Contracted vs New)
    "102.1", // Contracted ROW
    "102.2", // Contracted AMEX
    "102.3", // Level 3 New ROW
    "102.4", // Level 3 New AMEX
    "102.5", // Consultancies
    "102.6", // Marketing Coaching
    "102.7", // Others
    // 103.0 Planning Center (lógica de Clinics: Level 3/2/1 e ROW vs AMEX)
    "103.1", // Level 3 ROW
    "103.2", // Level 3 AMEX
    "103.3", // Level 3 New ROW
    "103.4", // Level 3 New AMEX
    "103.5", // Level 2
    "103.6", // Level 1
    "103.7", // Not a Subscriber
    // 104.0 LAB (lógica de Clinics: Level 3/2/1 e ROW vs AMEX)
    "104.1", // Level 3 ROW
    "104.2", // Level 3 AMEX
    "104.3", // Level 3 New ROW
    "104.4", // Level 3 New AMEX
    "104.5", // Level 2
    "104.6", // Level 1
    "104.7", // Not a Subscriber
    // 105.0 Other Income
    "105.1", // Level 1 (subscriptions)
    "105.2", // CORE Partnerships
    "105.3", // Study Club
    "105.4", // Other Marketing Revenues
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Buscar dados APENAS de invoice-orders (fonte principal de receita)
        // IMPORTANTE: usar range para pegar todos os registros (limite padrão é 1000)
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("source, date, amount, custom_data")
                .eq("source", "invoice-orders")
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

        console.log(`📊 Total de registros invoice-orders carregados: ${allData.length}`);

        // Inicializar todas as Financial Accounts
        const byFinancialAccount: { [key: string]: MonthlyData } = {};
        const byFinancialAccountCount: { [key: string]: MonthlyData } = {};
        for (const fa of ALL_FINANCIAL_ACCOUNTS) {
            byFinancialAccount[fa] = emptyMonthly();
            byFinancialAccountCount[fa] = emptyMonthly();
        }

        // Total por mês (todas as receitas)
        const totalRevenue: MonthlyData = emptyMonthly();

        // Processar cada linha - INCLUINDO credit notes (valores negativos) para P&L líquido
        for (const row of allData || []) {
            if (!row.date) continue;

            // Incluir TODOS os valores (positivos e negativos) - credit notes abatidas automaticamente
            const amount = row.amount || 0;
            if (amount === 0) continue; // Apenas ignorar zeros

            const monthIndex = new Date(row.date).getMonth();
            const monthKey = monthKeys[monthIndex];

            // Por Financial Account
            const fa = row.custom_data?.financial_account_code;
            if (fa && byFinancialAccount[fa]) {
                byFinancialAccount[fa][monthKey] += amount;
                byFinancialAccountCount[fa][monthKey]++;
            }

            // Total geral
            totalRevenue[monthKey] += amount;
        }

        // Log das estatísticas por categoria principal
        const categoryTotals: { [key: string]: number } = {};
        for (const fa of ALL_FINANCIAL_ACCOUNTS) {
            const category = fa.split('.')[0] + '.0';
            const total = Object.values(byFinancialAccount[fa]).reduce((a, b) => a + b, 0);
            categoryTotals[category] = (categoryTotals[category] || 0) + total;
        }

        console.log(`📊 P&L API - Ano ${year}:`, {
            totalRecords: allData.length,
            totalRevenue: Object.values(totalRevenue).reduce((a, b) => a + b, 0),
            categoryTotals
        });

        return NextResponse.json({
            success: true,
            year,
            totalRevenue,
            byFinancialAccount,
            byFinancialAccountCount,
            totalRecords: allData?.length || 0,
            categories: categoryTotals,
        });
    } catch (error) {
        console.error("Erro na API de receita:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar dados de receita" },
            { status: 500 }
        );
    }
}
