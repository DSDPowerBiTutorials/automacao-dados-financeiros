import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Buscar dados do HubSpot (Web Invoices)
        const { data: hubspotData, error: hubspotError } = await supabaseAdmin
            .from("csv_rows")
            .select("date, amount")
            .eq("source", "hubspot")
            .gte("date", startDate)
            .lte("date", endDate);

        if (hubspotError) {
            console.error("Erro ao buscar dados HubSpot:", hubspotError);
            return NextResponse.json({ error: hubspotError.message }, { status: 500 });
        }

        // Agrupar por mês
        const monthlyRevenue = {
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
        };
        const invoiceCount = {
            jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
            jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
        };
        const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

        for (const row of hubspotData || []) {
            if (!row.date) continue;
            const monthIndex = new Date(row.date).getMonth(); // 0-11
            const monthKey = monthKeys[monthIndex];
            monthlyRevenue[monthKey] += row.amount || 0;
            invoiceCount[monthKey]++;
        }

        console.log(`📊 P&L API - Ano ${year}:`, monthlyRevenue);

        return NextResponse.json({
            success: true,
            year,
            revenue: monthlyRevenue,
            count: invoiceCount,
            totalRecords: hubspotData?.length || 0,
        });
    } catch (error) {
        console.error("Erro na API de receita:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar dados de receita" },
            { status: 500 }
        );
    }
}
