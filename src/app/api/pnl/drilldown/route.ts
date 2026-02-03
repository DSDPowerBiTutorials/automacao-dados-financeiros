import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCode = searchParams.get("fa");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || "0"); // 0-indexed
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!faCode) {
        return NextResponse.json(
            { error: "financial_account_code (fa) é obrigatório" },
            { status: 400 }
        );
    }

    try {
        // Calcular range de datas para o mês
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0); // Último dia do mês

        const startStr = startDate.toISOString().split("T")[0];
        const endStr = endDate.toISOString().split("T")[0];

        // Buscar transações para este FA code e mês
        const { data, error, count } = await supabase
            .from("csv_rows")
            .select("id, date, description, amount, custom_data, source", { count: "exact" })
            .eq("source", "invoice-orders")
            .gte("date", startStr)
            .lte("date", endStr)
            .order("date", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (error) {
            console.error("Erro ao buscar drill-down:", error);
            return NextResponse.json(
                { error: "Erro ao buscar dados" },
                { status: 500 }
            );
        }

        // Filtrar por FA code (pois está em custom_data)
        const filtered = (data || []).filter((row) => {
            const rowFa = row.custom_data?.financial_account_code;
            return rowFa === faCode;
        });

        // Para contagem correta, precisamos buscar todos e filtrar
        const { data: allData } = await supabase
            .from("csv_rows")
            .select("id, custom_data")
            .eq("source", "invoice-orders")
            .gte("date", startStr)
            .lte("date", endStr);

        const totalFiltered = (allData || []).filter((row) => {
            return row.custom_data?.financial_account_code === faCode;
        }).length;

        // Formatar resultado
        const transactions = filtered.map((row) => ({
            id: row.id,
            date: row.date,
            description: row.description,
            amount: row.amount,
            customer: row.custom_data?.customer_name || row.custom_data?.client_name || "-",
            orderType: row.custom_data?.order_type || "-",
            source: row.source,
        }));

        return NextResponse.json({
            success: true,
            faCode,
            year,
            month: month + 1, // 1-indexed para display
            monthName: new Date(year, month).toLocaleString("pt-BR", { month: "long" }),
            transactions,
            pagination: {
                page,
                limit,
                total: totalFiltered,
                totalPages: Math.ceil(totalFiltered / limit),
            },
        });
    } catch (error) {
        console.error("Erro na API de drill-down:", error);
        return NextResponse.json(
            { error: "Erro interno ao buscar dados" },
            { status: 500 }
        );
    }
}
