import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Expense FA codes start with 2xx, 3xx, 4xx, 0xxx
const isExpenseFA = (faCode: string): boolean => {
    return /^[234]/.test(faCode) || faCode.startsWith("0");
};

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const faCode = searchParams.get("fa");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || "0"); // 0-indexed
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!faCode) {
        return NextResponse.json(
            { error: "financial_account_code (fa) é obrigatório" },
            { status: 400 }
        );
    }

    try {
        // Calcular range de datas para o mês (sem timezone issues)
        const monthStr = String(month + 1).padStart(2, "0");
        const startStr = `${year}-${monthStr}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

        console.log(`📊 Drill-down: FA=${faCode}, Mês=${month + 1}, Ano=${year}, Range=${startStr} a ${endStr}`);

        let transactions: any[] = [];
        let total = 0;
        let totalFiltered = 0;

        if (isExpenseFA(faCode)) {
            // ── EXPENSE DRILL-DOWN: query invoices table ──
            // For 210.0 (Miscellaneous), also include FA code "0000" (unassigned)
            const faCodes = faCode === "210.0" ? ["210.0", "0000"] : [faCode];

            const { data, error } = await supabaseAdmin
                .from("invoices")
                .select("id, benefit_date, description, invoice_amount, provider_code, financial_account_name, invoice_type, invoice_number")
                .in("financial_account_code", faCodes)
                .eq("dre_impact", true)
                .neq("invoice_type", "BUDGET")
                .gte("benefit_date", startStr)
                .lte("benefit_date", endStr)
                .neq("invoice_amount", 0)
                .order("invoice_amount", { ascending: false })
                .limit(500);

            if (error) {
                console.error("Erro ao buscar drill-down de despesas:", error);
                return NextResponse.json(
                    { error: "Erro ao buscar dados: " + error.message },
                    { status: 500 }
                );
            }

            totalFiltered = data?.length || 0;
            total = (data || []).reduce((sum, row) => sum + (row.invoice_amount || 0), 0);

            const startIndex = (page - 1) * limit;
            const paginatedData = (data || []).slice(startIndex, startIndex + limit);

            transactions = paginatedData.map((row) => ({
                id: row.id,
                date: row.benefit_date,
                description: row.description || row.financial_account_name || "-",
                amount: row.invoice_amount,
                customer: row.provider_code || "-",
                orderType: row.invoice_type || "-",
                source: "invoices",
                invoiceNumber: row.invoice_number,
            }));
        } else {
            // ── REVENUE DRILL-DOWN: query csv_rows table (existing logic) ──
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, description, amount, custom_data, source")
                .eq("source", "invoice-orders")
                .gte("date", startStr)
                .lte("date", endStr)
                .ilike("custom_data->>financial_account_code", faCode)
                .neq("amount", 0)
                .order("amount", { ascending: false })
                .limit(500);

            if (error) {
                console.error("Erro ao buscar drill-down de receita:", error);
                return NextResponse.json(
                    { error: "Erro ao buscar dados: " + error.message },
                    { status: 500 }
                );
            }

            totalFiltered = data?.length || 0;
            total = (data || []).reduce((sum, row) => sum + (row.amount || 0), 0);

            const startIndex = (page - 1) * limit;
            const paginatedData = (data || []).slice(startIndex, startIndex + limit);

            transactions = paginatedData.map((row) => ({
                id: row.id,
                date: row.date,
                description: row.description,
                amount: row.amount,
                customer: row.custom_data?.customer_name || row.custom_data?.client_name || "-",
                orderType: row.custom_data?.order_type || row.custom_data?.product_line || "-",
                source: row.source,
            }));
        }

        console.log(`📊 Drill-down resultado: ${totalFiltered} transações, total €${total.toFixed(2)}`);

        return NextResponse.json({
            success: true,
            faCode,
            year,
            month: month + 1,
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
