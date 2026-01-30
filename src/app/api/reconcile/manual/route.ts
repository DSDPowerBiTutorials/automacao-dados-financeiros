/**
 * API Endpoint: Reconciliação Manual
 * 
 * POST /api/reconcile/manual
 * 
 * Permite marcar invoices como reconciliadas manualmente
 * para casos onde o pagamento não passou por Braintree/Stripe/GoCardless
 * (ex: Credit Payment, transferência bancária direta, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface ManualReconcileRequest {
    invoiceId: number;
    paymentSource: string;  // 'credit-payment', 'bank-transfer', 'hubspot-confirmed', etc.
    paymentReference?: string;
    notes?: string;
}

export async function POST(req: NextRequest) {
    try {
        const body: ManualReconcileRequest = await req.json();

        if (!body.invoiceId) {
            return NextResponse.json({ success: false, error: "invoiceId is required" }, { status: 400 });
        }

        if (!body.paymentSource) {
            return NextResponse.json({ success: false, error: "paymentSource is required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('ar_invoices')
            .update({
                reconciled: true,
                reconciled_at: new Date().toISOString(),
                reconciled_with: `${body.paymentSource}:${body.paymentReference || 'manual'}`,
                payment_reference: body.paymentReference || null,
                note: body.notes || null,
            })
            .eq('id', body.invoiceId)
            .select()
            .single();

        if (error) {
            console.error('[Manual Reconcile] Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Invoice ${data.invoice_number} reconciled manually`,
            invoice: data
        });

    } catch (error: any) {
        console.error('[Manual Reconcile] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/reconcile/manual
 * 
 * Remove reconciliação de uma invoice (desfazer)
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const invoiceId = searchParams.get('invoiceId');

        if (!invoiceId) {
            return NextResponse.json({ success: false, error: "invoiceId is required" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('ar_invoices')
            .update({
                reconciled: false,
                reconciled_at: null,
                reconciled_with: null,
                payment_reference: null,
            })
            .eq('id', parseInt(invoiceId))
            .select()
            .single();

        if (error) {
            console.error('[Manual Reconcile DELETE] Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Reconciliation removed from ${data.invoice_number}`,
            invoice: data
        });

    } catch (error: any) {
        console.error('[Manual Reconcile DELETE] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
