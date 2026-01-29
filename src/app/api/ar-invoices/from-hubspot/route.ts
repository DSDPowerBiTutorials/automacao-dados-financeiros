import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    // Busca todas as vendas do HubSpot com invoice date
    const { data: rows, error } = await supabaseAdmin
        .from("csv_rows")
        .select("*")
        .eq("source", "hubspot");

    if (error) {
        return NextResponse.json({ success: false, error: error.message });
    }

    let created = 0;
    let skipped = 0;
    let errors: any[] = [];

    for (const row of rows || []) {
        const cd = row.custom_data || {};
        const invoiceDate = cd.hs_invoice_date || cd.invoice_date;
        if (!invoiceDate) {
            skipped++;
            continue;
        }

        // Checa duplicidade por order_number + invoice_date
        const { data: existing } = await supabaseAdmin
            .from("invoices")
            .select("id")
            .eq("order_number", cd.order_code || cd.dealname || row.id)
            .eq("invoice_date", invoiceDate)
            .maybeSingle();
        if (existing) {
            skipped++;
            continue;
        }

        // Monta payload
        const payload: any = {
            invoice_date: invoiceDate,
            order_number: cd.order_code || cd.dealname || row.id,
            customer_name: cd.customer_name || cd.customer_firstname || row.customer_name,
            company_name: cd.company || cd.company_name,
            email: cd.customer_email || row.customer_email,
            invoice_amount: cd.total_amount || cd.final_price || cd.amount || row.amount,
            currency: cd.currency || row.currency,
            payment_method_code: cd.payment_method || cd.gateway,
            description: cd.product_name || cd.product_name_full || row.description,
            notes: cd.notes || row.notes,
            source: "hubspot",
        };

        // Insere invoice
        const { error: insertError } = await supabaseAdmin.from("invoices").insert([payload]);
        if (insertError) {
            errors.push({ order: payload.order_number, error: insertError.message });
        } else {
            created++;
        }
    }

    return NextResponse.json({ success: true, created, skipped, errors });
}
