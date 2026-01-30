/**
 * API Endpoint: Reconciliação Automática Multi-Source
 * 
 * POST /api/reconcile/auto
 * 
 * Reconcilia automaticamente AR Invoices (HubSpot) com pagamentos:
 * - Braintree
 * - Stripe
 * - GoCardless
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface Payment {
    source: string;
    transaction_id: string;
    date: string;
    amount: number;
    email: string | null;
    order_id: string | null;
}

interface Match {
    invoice_id: number;
    invoice_number: string;
    payment_source: string;
    transaction_id: string;
    payment_amount: number;
    invoice_amount: number;
    match_type: string;
}

async function fetchAllFromSource(source: string, minDate: string = '2025-12-01'): Promise<any[]> {
    let all: any[] = [];
    let offset = 0;
    while (true) {
        const { data } = await supabaseAdmin
            .from('csv_rows')
            .select('*')
            .eq('source', source)
            .gte('date', minDate)
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false; // Default: dry run

        // Buscar transações de todos os gateways em paralelo
        const [braintree, stripeEur, gocardless] = await Promise.all([
            fetchAllFromSource('braintree-api-revenue'),
            fetchAllFromSource('stripe-eur'),
            fetchAllFromSource('gocardless')
        ]);

        // Normalizar transações para formato comum
        const allPayments: Payment[] = [];

        // Braintree
        braintree.forEach(bt => {
            const cd = bt.custom_data || {};
            allPayments.push({
                source: 'braintree',
                transaction_id: cd.transaction_id || bt.id,
                date: bt.date,
                amount: bt.amount,
                email: bt.customer_email?.toLowerCase() || null,
                order_id: cd.order_id || null
            });
        });

        // Stripe
        stripeEur.forEach(st => {
            const cd = st.custom_data || {};
            allPayments.push({
                source: 'stripe',
                transaction_id: cd.payment_intent || cd.charge_id || st.id,
                date: st.date,
                amount: st.amount,
                email: cd.customer_email?.toLowerCase() || null,
                order_id: cd.order_id || cd.metadata?.order_id || null
            });
        });

        // GoCardless
        gocardless.forEach(gc => {
            const cd = gc.custom_data || {};
            allPayments.push({
                source: 'gocardless',
                transaction_id: cd.payment_id || cd.gocardless_id || gc.id,
                date: gc.date,
                amount: gc.amount,
                email: cd.customer_email?.toLowerCase() || null,
                order_id: null
            });
        });

        // Buscar invoices pendentes
        let invoices: any[] = [];
        let offset = 0;
        while (true) {
            const { data } = await supabaseAdmin
                .from('ar_invoices')
                .select('*')
                .eq('source', 'hubspot')
                .or('reconciled.is.null,reconciled.eq.false')
                .range(offset, offset + 999);
            if (!data || data.length === 0) break;
            invoices = invoices.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
        }

        // Criar mapas
        const invoiceByOrderId = new Map<string, any>();
        const invoiceByEmail = new Map<string, any[]>();
        const invoiceByEmailDomain = new Map<string, any[]>();
        const invoiceByAmountDate = new Map<number, any[]>();
        const invoiceByCompanyName = new Map<string, any[]>();

        invoices.forEach(inv => {
            if (inv.order_id) {
                invoiceByOrderId.set(inv.order_id.toLowerCase(), inv);
            }
            if (inv.email) {
                const email = inv.email.toLowerCase();
                if (!invoiceByEmail.has(email)) invoiceByEmail.set(email, []);
                invoiceByEmail.get(email)!.push(inv);

                // Index por domínio do email
                const domain = email.split('@')[1];
                if (domain) {
                    if (!invoiceByEmailDomain.has(domain)) invoiceByEmailDomain.set(domain, []);
                    invoiceByEmailDomain.get(domain)!.push(inv);
                }
            }
            // Index por company_name normalizado
            if (inv.company_name) {
                const companyKey = inv.company_name.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!invoiceByCompanyName.has(companyKey)) invoiceByCompanyName.set(companyKey, []);
                invoiceByCompanyName.get(companyKey)!.push(inv);
            }
            const amountKey = Math.round(inv.total_amount);
            if (!invoiceByAmountDate.has(amountKey)) invoiceByAmountDate.set(amountKey, []);
            invoiceByAmountDate.get(amountKey)!.push(inv);
        });

        // Fazer matching
        const matches: Match[] = [];
        const stats = { braintree: 0, stripe: 0, gocardless: 0, hubspot_confirmed: 0 };
        const matchedInvoiceIds = new Set<number>();

        for (const payment of allPayments) {
            let invoice: any = null;
            let matchType: string | null = null;

            // 1. Match por order_id
            let orderId = payment.order_id;
            if (orderId) {
                if (orderId.includes('-') && orderId.length > 8) {
                    orderId = orderId.split('-')[0];
                }
                const orderKey = orderId.toLowerCase();
                if (invoiceByOrderId.has(orderKey) && !matchedInvoiceIds.has(invoiceByOrderId.get(orderKey).id)) {
                    invoice = invoiceByOrderId.get(orderKey);
                    matchType = 'order_id';
                }
            }

            // 2. Match por email + valor
            if (!invoice && payment.email) {
                const candidates = (invoiceByEmail.get(payment.email) || [])
                    .filter(inv => !matchedInvoiceIds.has(inv.id));
                const amountMatch = candidates.find(inv =>
                    Math.abs(inv.total_amount - payment.amount) < 1
                );
                if (amountMatch) {
                    invoice = amountMatch;
                    matchType = 'email+amount';
                }
            }

            // 3. Match por domínio do email + valor + data (mesmo negócio, emails diferentes)
            if (!invoice && payment.email) {
                const domain = payment.email.split('@')[1];
                if (domain) {
                    const candidates = (invoiceByEmailDomain.get(domain) || [])
                        .filter(inv => !matchedInvoiceIds.has(inv.id));
                    const paymentDate = new Date(payment.date);
                    const domainMatch = candidates.find(inv => {
                        const invDate = new Date(inv.invoice_date || inv.order_date);
                        const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                        return daysDiff <= 3 && Math.abs(inv.total_amount - payment.amount) < 1;
                    });
                    if (domainMatch) {
                        invoice = domainMatch;
                        matchType = 'domain+amount+date';
                    }
                }
            }

            // 4. Match por valor + data (todos os gateways, janela ±3 dias)
            if (!invoice) {
                const amountKey = Math.round(payment.amount);
                const candidates = (invoiceByAmountDate.get(amountKey) || [])
                    .filter(inv => !matchedInvoiceIds.has(inv.id));
                const paymentDate = new Date(payment.date);
                const dateMatch = candidates.find(inv => {
                    const invDate = new Date(inv.invoice_date || inv.order_date);
                    const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                    return daysDiff <= 3 && Math.abs(inv.total_amount - payment.amount) < 1;
                });
                if (dateMatch) {
                    invoice = dateMatch;
                    matchType = 'amount+date';
                }
            }

            if (invoice && matchType) {
                matchedInvoiceIds.add(invoice.id);
                stats[payment.source as keyof typeof stats]++;
                matches.push({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    payment_source: payment.source,
                    transaction_id: payment.transaction_id,
                    payment_amount: payment.amount,
                    invoice_amount: invoice.total_amount,
                    match_type: matchType
                });
            }
        }

        // 4. Reconciliar por HubSpot order_status para Credit Payment e outros
        // Invoices com order_status = "Paid" que não foram matchadas por gateway
        for (const inv of invoices) {
            if (matchedInvoiceIds.has(inv.id)) continue;

            // Check order_status from HubSpot sync (campo que indica pagamento)
            const orderStatus = inv.order_status;
            const paymentMethod = (inv.payment_method || '').toLowerCase();

            // Se order_status = Paid e não foi matchado por gateway
            if (orderStatus === 'Paid') {
                // Determinar fonte baseado no payment_method
                let source = 'hubspot-confirmed';
                if (paymentMethod.includes('credit')) {
                    source = 'credit-payment';
                } else if (paymentMethod.includes('transfer') || paymentMethod.includes('bank')) {
                    source = 'bank-transfer';
                }

                matchedInvoiceIds.add(inv.id);
                stats.hubspot_confirmed++;
                matches.push({
                    invoice_id: inv.id,
                    invoice_number: inv.invoice_number,
                    payment_source: source,
                    transaction_id: `hubspot-${inv.hubspot_id || inv.id}`,
                    payment_amount: inv.total_amount,
                    invoice_amount: inv.total_amount,
                    match_type: 'hubspot_paid_status'
                });
            }
        }

        // Aplicar se não for dry run
        let updated = 0;
        const errors: string[] = [];
        if (!dryRun && matches.length > 0) {
            for (const match of matches) {
                const { error } = await supabaseAdmin
                    .from('ar_invoices')
                    .update({
                        status: 'paid',
                        reconciled: true,
                        reconciled_at: new Date().toISOString(),
                        reconciled_with: `${match.payment_source}:${match.transaction_id}`,
                        reconciliation_type: 'automatic',
                        payment_reference: match.transaction_id,
                    })
                    .eq('id', match.invoice_id);
                if (error) {
                    errors.push(`${match.invoice_id}: ${error.message}`);
                } else {
                    updated++;
                }
            }
        }

        const totalValue = matches.reduce((sum, m) => sum + m.payment_amount, 0);

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                payments: {
                    braintree: braintree.length,
                    stripe: stripeEur.length,
                    gocardless: gocardless.length,
                    total: allPayments.length
                },
                invoicesPending: invoices.length,
                matched: matches.length,
                bySource: stats,
                totalValue,
                updated: dryRun ? 0 : updated,
                errors: errors.slice(0, 10)
            },
            matches: matches.slice(0, 20) // Limitar amostra
        });

    } catch (error: any) {
        console.error('[Reconcile API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
