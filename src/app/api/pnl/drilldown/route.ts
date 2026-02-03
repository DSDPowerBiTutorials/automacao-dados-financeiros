import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCode = searchParams.get("fa");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || "0"); // 0-indexed
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100"); // Aumentado para 100

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

        console.log(`📊 Drill-down: FA=${faCode}, Mês=${month}, Ano=${year}, Range=${startStr} a ${endStr}`);

        // Buscar TODAS as transações do mês e filtrar por FA code
        // Usar ilike para filtrar diretamente no JSONB
        const { data, error } = await supabaseAdmin
            .from("csv_rows")
            .select("id, date, description, amount, custom_data, source")
            .eq("source", "invoice-orders")
            .gte("date", startStr)
            .lte("date", endStr)
            .ilike("custom_data->>financial_account_code", faCode)
            .gt("amount", 0)
            .order("amount", { ascending: false })
            .limit(500);

        if (error) {
            console.error("Erro ao buscar drill-down:", error);
            return NextResponse.json(
                { error: "Erro ao buscar dados: " + error.message },
                { status: 500 }
            );
        }

        // Paginar resultados
        const startIndex = (page - 1) * limit;
        const paginatedData = (data || []).slice(startIndex, startIndex + limit);
        const totalFiltered = data?.length || 0;

        // Formatar resultado
        const transactions = paginatedData.map((row) => ({
            id: row.id,
            date: row.date,
            description: row.description,
            amount: row.amount,
            customer: row.custom_data?.customer_name || row.custom_data?.client_name || "-",
            orderType: row.custom_data?.order_type || row.custom_data?.product_line || "-",
            source: row.source,
        }));

        // Calcular total
        const total = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);

        console.log(`📊 Drill-down resultado: ${totalFiltered} transações, total €${total.toFixed(2)}`);

        return NextResponse.json({
            success: true,
            faCode,
            year,
            month: month + 1, // 1-indexed para display
            monthName: new Date(year, month).toLocaleString("pt-BR", { month: "long" }),
            transactions,
            total,
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
