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
    customer_name: string | null;
    customer_company: string | null;
    billing_name: string | null;
    csv_row_id: string;
}

/** Normalize company/person name for fuzzy matching */
function normalizeName(name: string | null | undefined): string | null {
    if (!name) return null;
    return name.toLowerCase().replace(/[^a-z0-9]/g, '') || null;
}

interface Match {
    invoice_id: number;
    invoice_number: string;
    payment_source: string;
    transaction_id: string;
    payment_amount: number;
    invoice_amount: number;
    match_type: string;
    csv_row_id: string;
    financial_account_code: string | null;
    financial_account_name: string | null;
}

async function fetchAllFromSource(source: string, minDate: string = '2025-01-01'): Promise<any[]> {
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
        const [braintree, stripeEur, stripeUsd, gocardless] = await Promise.all([
            fetchAllFromSource('braintree-api-revenue'),
            fetchAllFromSource('stripe-eur'),
            fetchAllFromSource('stripe-usd'),
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
                email: bt.customer_email?.toLowerCase() || cd.customer_email?.toLowerCase() || null,
                order_id: cd.order_id || null,
                customer_name: cd.customer_name || bt.customer_name || null,
                customer_company: cd.customer_company || cd.company_name || null,
                billing_name: cd.billing_name || null,
                csv_row_id: bt.id,
            });
        });

        // Stripe EUR
        stripeEur.forEach(st => {
            const cd = st.custom_data || {};
            allPayments.push({
                source: 'stripe',
                transaction_id: cd.payment_intent || cd.charge_id || st.id,
                date: st.date,
                amount: st.amount,
                email: cd.customer_email?.toLowerCase() || st.customer_email?.toLowerCase() || null,
                order_id: cd.order_id || cd.metadata?.order_id || null,
                customer_name: cd.customer_name || st.customer_name || null,
                customer_company: cd.customer_company || null,
                billing_name: null,
                csv_row_id: st.id,
            });
        });

        // Stripe USD
        stripeUsd.forEach(st => {
            const cd = st.custom_data || {};
            allPayments.push({
                source: 'stripe',
                transaction_id: cd.payment_intent || cd.charge_id || st.id,
                date: st.date,
                amount: st.amount,
                email: cd.customer_email?.toLowerCase() || st.customer_email?.toLowerCase() || null,
                order_id: cd.order_id || cd.metadata?.order_id || null,
                customer_name: cd.customer_name || st.customer_name || null,
                customer_company: cd.customer_company || null,
                billing_name: null,
                csv_row_id: st.id,
            });
        });

        // GoCardless — ONLY payments (type=payment), payouts have no customer info
        gocardless
            .filter(gc => {
                const cd = gc.custom_data || {};
                const type = (cd.type || cd.resource_type || '').toLowerCase();
                // Include payments, exclude payouts/refunds
                return type !== 'payout' && type !== 'refund';
            })
            .forEach(gc => {
                const cd = gc.custom_data || {};
                allPayments.push({
                    source: 'gocardless',
                    transaction_id: cd.payment_id || cd.gocardless_id || gc.id,
                    date: gc.date,
                    amount: gc.amount,
                    email: cd.customer_email?.toLowerCase() || gc.customer_email?.toLowerCase() || null,
                    order_id: cd.order_id || cd.mandate_id || null,
                    customer_name: cd.customer_name || gc.customer_name || null,
                    customer_company: cd.customer_company || cd.company_name || null,
                    billing_name: null,
                    csv_row_id: gc.id,
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

        // Index por customer_name normalizado para invoices
        const invoiceByClientName = new Map<string, any[]>();
        invoices.forEach(inv => {
            if (inv.client_name) {
                const nameKey = normalizeName(inv.client_name);
                if (nameKey && nameKey.length >= 3) {
                    if (!invoiceByClientName.has(nameKey)) invoiceByClientName.set(nameKey, []);
                    invoiceByClientName.get(nameKey)!.push(inv);
                }
            }
        });

        console.log(`[auto] Payments: ${allPayments.length} (BT:${braintree.length} Stripe:${stripeEur.length + stripeUsd.length} GC:${gocardless.length})`);
        console.log(`[auto] Invoices: ${invoices.length} | Indexes: orderId=${invoiceByOrderId.size} email=${invoiceByEmail.size} domain=${invoiceByEmailDomain.size} company=${invoiceByCompanyName.size} clientName=${invoiceByClientName.size} amount=${invoiceByAmountDate.size}`);

        // Fazer matching
        const matches: Match[] = [];
        const stats = { braintree: 0, stripe: 0, gocardless: 0, hubspot_confirmed: 0, by_strategy: {} as Record<string, number> };
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

            // 2. Match por email + valor + data ±30 dias
            if (!invoice && payment.email) {
                const candidates = (invoiceByEmail.get(payment.email) || [])
                    .filter(inv => !matchedInvoiceIds.has(inv.id));
                const paymentDate = new Date(payment.date);
                const amountMatch = candidates.find(inv => {
                    const invDate = new Date(inv.invoice_date || inv.order_date);
                    const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                    return daysDiff <= 30 && Math.abs(inv.total_amount - payment.amount) < 1;
                });
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

            // 4. Match por valor + data (todos os gateways, janela ±5 dias, tolerância ±1 no amount key)
            if (!invoice) {
                const amountKey = Math.round(payment.amount);
                // Check amount key and neighbors (±1) for near-misses
                const candidateKeys = [amountKey - 1, amountKey, amountKey + 1];
                const allCandidates: any[] = [];
                for (const key of candidateKeys) {
                    const list = invoiceByAmountDate.get(key);
                    if (list) allCandidates.push(...list);
                }
                const uniqueCandidates = allCandidates
                    .filter(inv => !matchedInvoiceIds.has(inv.id));
                const paymentDate = new Date(payment.date);
                const dateMatch = uniqueCandidates.find(inv => {
                    const invDate = new Date(inv.invoice_date || inv.order_date);
                    const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                    return daysDiff <= 5 && Math.abs(inv.total_amount - payment.amount) < 1;
                });
                if (dateMatch) {
                    invoice = dateMatch;
                    matchType = 'amount+date';
                }
            }

            // 5. Match por company_name + valor ±2% + data ±7 dias
            if (!invoice && payment.customer_company) {
                const companyKey = normalizeName(payment.customer_company);
                if (companyKey) {
                    const candidates = (invoiceByCompanyName.get(companyKey) || [])
                        .filter(inv => !matchedInvoiceIds.has(inv.id));
                    const paymentDate = new Date(payment.date);
                    const companyMatch = candidates.find(inv => {
                        const invDate = new Date(inv.invoice_date || inv.order_date);
                        const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                        const amountTolerance = Math.max(1, payment.amount * 0.02); // 2% or €1 min
                        return daysDiff <= 7 && Math.abs(inv.total_amount - payment.amount) < amountTolerance;
                    });
                    if (companyMatch) {
                        invoice = companyMatch;
                        matchType = 'company_name+amount';
                    }
                }
            }

            // 6. Match por customer_name ↔ client_name + valor ±€2 + data ±5 dias
            if (!invoice && payment.customer_name) {
                const nameKey = normalizeName(payment.customer_name);
                if (nameKey && nameKey.length >= 3) {
                    // Try exact normalized name match first
                    let candidates = (invoiceByClientName.get(nameKey) || [])
                        .filter(inv => !matchedInvoiceIds.has(inv.id));

                    // Try partial match (payment name contained in invoice name or vice versa)
                    if (candidates.length === 0) {
                        for (const [invNameKey, invList] of invoiceByClientName) {
                            if (invNameKey.includes(nameKey) || nameKey.includes(invNameKey)) {
                                candidates.push(...invList.filter(inv => !matchedInvoiceIds.has(inv.id)));
                            }
                        }
                    }

                    const paymentDate = new Date(payment.date);
                    const nameMatch = candidates.find(inv => {
                        const invDate = new Date(inv.invoice_date || inv.order_date);
                        const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                        return daysDiff <= 5 && Math.abs(inv.total_amount - payment.amount) < 2;
                    });
                    if (nameMatch) {
                        invoice = nameMatch;
                        matchType = 'customer_name+amount';
                    }
                }
            }

            if (invoice && matchType) {
                matchedInvoiceIds.add(invoice.id);
                stats[payment.source as keyof typeof stats]++;
                stats.by_strategy[matchType] = (stats.by_strategy[matchType] || 0) + 1;
                matches.push({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    payment_source: payment.source,
                    transaction_id: payment.transaction_id,
                    payment_amount: payment.amount,
                    invoice_amount: invoice.total_amount,
                    match_type: matchType,
                    csv_row_id: payment.csv_row_id,
                    financial_account_code: invoice.financial_account_code || null,
                    financial_account_name: invoice.financial_account_name || null,
                });
            }
        }

        // 4b. Strategy 7: billing_name → client_name + amount ±€2 + date ±5 days (Braintree only)
        for (const payment of allPayments) {
            if (!payment.billing_name) continue;
            // Check if this payment was already matched
            const alreadyMatched = matches.some(m => m.transaction_id === payment.transaction_id && m.payment_source === payment.source);
            if (alreadyMatched) continue;

            const billingNameKey = normalizeName(payment.billing_name);
            if (!billingNameKey || billingNameKey.length < 3) continue;

            // Skip if same as customer_name (already tried in strategy 6)
            const customerNameKey = normalizeName(payment.customer_name);
            if (billingNameKey === customerNameKey) continue;

            let invoice: any = null;

            // Try exact billing name match against client_name index
            let candidates = (invoiceByClientName.get(billingNameKey) || [])
                .filter(inv => !matchedInvoiceIds.has(inv.id));

            // Partial match fallback
            if (candidates.length === 0) {
                for (const [invNameKey, invList] of invoiceByClientName) {
                    if (invNameKey.includes(billingNameKey) || billingNameKey.includes(invNameKey)) {
                        candidates.push(...invList.filter(inv => !matchedInvoiceIds.has(inv.id)));
                    }
                }
            }

            const paymentDate = new Date(payment.date);
            const billingMatch = candidates.find(inv => {
                const invDate = new Date(inv.invoice_date || inv.order_date);
                const daysDiff = Math.abs((paymentDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));
                return daysDiff <= 5 && Math.abs(inv.total_amount - payment.amount) < 2;
            });

            if (billingMatch) {
                invoice = billingMatch;
                matchedInvoiceIds.add(invoice.id);
                stats[payment.source as keyof typeof stats]++;
                stats.by_strategy['billing_name+amount'] = (stats.by_strategy['billing_name+amount'] || 0) + 1;
                matches.push({
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    payment_source: payment.source,
                    transaction_id: payment.transaction_id,
                    payment_amount: payment.amount,
                    invoice_amount: invoice.total_amount,
                    match_type: 'billing_name+amount',
                    csv_row_id: payment.csv_row_id,
                    financial_account_code: invoice.financial_account_code || null,
                    financial_account_name: invoice.financial_account_name || null,
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
                    match_type: 'hubspot_paid_status',
                    csv_row_id: '',
                    financial_account_code: inv.financial_account_code || null,
                    financial_account_name: inv.financial_account_name || null,
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
                    // Write FAC classification to the gateway csv_row
                    if (match.csv_row_id && match.financial_account_code) {
                        const { data: existingRow } = await supabaseAdmin
                            .from('csv_rows')
                            .select('custom_data')
                            .eq('id', match.csv_row_id)
                            .single();
                        const prevData = (existingRow?.custom_data as Record<string, unknown>) || {};
                        await supabaseAdmin
                            .from('csv_rows')
                            .update({
                                reconciled: true,
                                custom_data: {
                                    ...prevData,
                                    matched_invoice_number: match.invoice_number,
                                    matched_invoice_fac: match.financial_account_code,
                                    matched_invoice_fac_name: match.financial_account_name,
                                    reconciled_with: `ar_invoice:${match.invoice_id}`,
                                    reconciliation_type: match.match_type,
                                },
                            })
                            .eq('id', match.csv_row_id);
                    }
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
                    stripe_eur: stripeEur.length,
                    stripe_usd: stripeUsd.length,
                    gocardless: gocardless.length,
                    total: allPayments.length
                },
                byStrategy: stats.by_strategy,
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
