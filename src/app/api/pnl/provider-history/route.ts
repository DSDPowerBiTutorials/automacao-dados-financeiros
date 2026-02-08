import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const providerCode = searchParams.get("provider");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!providerCode) {
        return NextResponse.json(
            { error: "provider code is required" },
            { status: 400 }
        );
    }

    try {
        const { data, error } = await supabaseAdmin
            .from("invoices")
            .select(`
                id, benefit_date, invoice_date, due_date, schedule_date, payment_date,
                description, invoice_amount, currency, provider_code,
                financial_account_name, financial_account_code, invoice_type, invoice_number,
                bank_account_code, payment_status, paid_amount, paid_currency,
                dre_impact, cash_impact
            `)
            .eq("provider_code", providerCode)
            .neq("invoice_type", "BUDGET")
            .order("benefit_date", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Erro ao buscar histórico do fornecedor:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Resolve bank account names
        const bankCodes = [...new Set((data || []).map(r => r.bank_account_code).filter(Boolean))];
        const bankNames: Record<string, string> = {};
        if (bankCodes.length > 0) {
            const { data: banks } = await supabaseAdmin
                .from("bank_accounts")
                .select("code, name")
                .in("code", bankCodes);
            if (banks) banks.forEach(b => { bankNames[b.code] = b.name; });
        }

        const invoices = (data || []).map(row => ({
            id: row.id,
            invoiceDate: row.invoice_date,
            benefitDate: row.benefit_date,
            dueDate: row.due_date,
            scheduleDate: row.schedule_date,
            paymentDate: row.payment_date,
            description: row.description,
            amount: row.invoice_amount,
            currency: row.currency || "EUR",
            invoiceNumber: row.invoice_number,
            invoiceType: row.invoice_type,
            faCode: row.financial_account_code,
            faName: row.financial_account_name,
            bankAccountCode: row.bank_account_code,
            bankAccountName: bankNames[row.bank_account_code] || null,
            paymentStatus: row.payment_status,
            paidAmount: row.paid_amount,
            paidCurrency: row.paid_currency,
            dreImpact: row.dre_impact,
            cashImpact: row.cash_impact,
        }));

        const totalSpend = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

        return NextResponse.json({
            success: true,
            providerCode,
            invoices,
            totalInvoices: invoices.length,
            totalSpend,
        });
    } catch (error) {
        console.error("Erro na API de provider history:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}
