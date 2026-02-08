import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const providerCode = searchParams.get("provider");
    const customerName = searchParams.get("customer");
    const type = searchParams.get("type") || "expense"; // "expense" or "revenue"
    const limit = parseInt(searchParams.get("limit") || "100");

    if (!providerCode && !customerName) {
        return NextResponse.json(
            { error: "provider or customer is required" },
            { status: 400 }
        );
    }

    try {
        if (type === "revenue" && customerName) {
            // ── Revenue history: query csv_rows by customer name ──
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, description, amount, custom_data, source")
                .eq("source", "invoice-orders")
                .ilike("custom_data->>customer_name", customerName)
                .neq("amount", 0)
                .order("date", { ascending: false })
                .limit(limit);

            if (error) {
                console.error("Error fetching customer history:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            const invoices = (data || []).map(row => ({
                id: row.id,
                invoiceDate: row.date,
                benefitDate: row.date,
                dueDate: null,
                scheduleDate: null,
                paymentDate: null,
                description: row.description,
                amount: row.amount,
                currency: row.custom_data?.currency || "EUR",
                invoiceNumber: row.custom_data?.invoice_number || null,
                invoiceType: row.custom_data?.order_type || row.custom_data?.product_line || null,
                faCode: row.custom_data?.financial_account_code || null,
                faName: row.custom_data?.financial_account_name || null,
                bankAccountCode: null,
                bankAccountName: null,
                paymentStatus: null,
                paidAmount: null,
                paidCurrency: null,
                dreImpact: null,
                cashImpact: null,
                customerName: row.custom_data?.customer_name || null,
                source: "csv_rows",
            }));

            // Collect unique FA codes for the filter
            const faCodesSet = new Set(invoices.map(i => i.faCode).filter(Boolean));
            const uniqueFACodes = [...faCodesSet].sort();

            const totalSpend = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

            return NextResponse.json({
                success: true,
                customerName,
                type: "revenue",
                invoices,
                totalInvoices: invoices.length,
                totalSpend,
                uniqueFACodes,
            });
        } else {
            // ── Expense history: query invoices table by provider_code ──
            const { data, error } = await supabaseAdmin
                .from("invoices")
                .select(`
                    id, benefit_date, invoice_date, due_date, schedule_date, payment_date,
                    description, invoice_amount, currency, provider_code,
                    financial_account_name, financial_account_code, invoice_type, invoice_number,
                    bank_account_code, payment_status, paid_amount, paid_currency,
                    dre_impact, cash_impact
                `)
                .eq("provider_code", providerCode!)
                .neq("invoice_type", "BUDGET")
                .order("benefit_date", { ascending: false })
                .limit(limit);

            if (error) {
                console.error("Error fetching provider history:", error);
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
                source: "invoices",
            }));

            // Collect unique FA codes for the filter
            const faCodesSet = new Set(invoices.map(i => i.faCode).filter(Boolean));
            const uniqueFACodes = [...faCodesSet].sort();

            const totalSpend = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

            return NextResponse.json({
                success: true,
                providerCode,
                type: "expense",
                invoices,
                totalInvoices: invoices.length,
                totalSpend,
                uniqueFACodes,
            });
        }
    } catch (error) {
        console.error("Error in provider/customer history API:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
