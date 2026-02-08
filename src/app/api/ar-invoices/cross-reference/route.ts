import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// 🔗 CROSS-REFERENCE: AR Invoices ↔ Web Orders (csv_rows hubspot)
//
// Lógica de matching em 4 níveis:
//   1. Match EXATO por order_id ↔ order_code
//   2. Match por email + amount (±0.01)
//   3. Match por company + amount + date (±3 dias)
//   4. Match por client_name + amount + date (±3 dias)
//
// Enriquecimento mútuo:
//   - AR Invoice → preencher campos vazios com dados do Web Order
//   - Web Order → preencher campos vazios com dados da AR Invoice
// ============================================================

export const maxDuration = 120; // 2 minutos para processar tudo

interface MatchResult {
    ar_invoice_id: string;
    csv_row_id: string;
    match_type: 'order_id' | 'email_amount' | 'company_amount_date' | 'name_amount_date';
    confidence: number;
    enriched_fields_ar: string[];
    enriched_fields_csv: string[];
}

// Normalizar string para comparação
function normalize(s: string | null | undefined): string {
    if (!s) return '';
    return s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .replace(/[^a-z0-9]/g, '') // Só alfanuméricos
        .trim();
}

// Verificar se datas estão dentro de ±N dias
function datesWithinDays(d1: string | null, d2: string | null, days: number): boolean {
    if (!d1 || !d2) return false;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return false;
    return Math.abs(t1 - t2) <= days * 24 * 60 * 60 * 1000;
}

// Verificar se amounts são aproximados (±0.01)
function amountsMatch(a1: number | null, a2: number | null, tolerance: number = 0.01): boolean {
    if (a1 == null || a2 == null) return false;
    return Math.abs(a1 - a2) <= tolerance;
}

// Similaridade fuzzy para nomes
function nameSimilarity(s1: string, s2: string): number {
    const n1 = normalize(s1);
    const n2 = normalize(s2);
    if (!n1 || !n2) return 0;
    if (n1 === n2) return 1;

    // Substring containment
    if (n1.includes(n2) || n2.includes(n1)) {
        const minLen = Math.min(n1.length, n2.length);
        const maxLen = Math.max(n1.length, n2.length);
        return minLen / maxLen;
    }

    // Word overlap
    const words1 = new Set(n1.match(/[a-z]+/g) || []);
    const words2 = new Set(n2.match(/[a-z]+/g) || []);
    if (words1.size === 0 || words2.size === 0) return 0;
    let common = 0;
    for (const w of words1) { if (words2.has(w)) common++; }
    return (2 * common) / (words1.size + words2.size);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun === true;
        const scope = body.scope || null; // Filtrar por scope ("ES", etc.)

        console.log(`🔗 [cross-ref] Iniciando cross-reference... (dryRun=${dryRun})`);

        // ============================================================
        // 1. Carregar TODOS os dados
        // ============================================================

        // AR Invoices (paginado)
        let arInvoices: any[] = [];
        let offset = 0;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("ar_invoices")
                .select("*")
                .range(offset, offset + 999);
            if (error) throw error;
            if (!data || data.length === 0) break;
            arInvoices = arInvoices.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
        }

        // Web Orders = csv_rows hubspot (paginado)
        let webOrders: any[] = [];
        offset = 0;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", "hubspot")
                .range(offset, offset + 999);
            if (error) throw error;
            if (!data || data.length === 0) break;
            webOrders = webOrders.concat(data);
            if (data.length < 1000) break;
            offset += 1000;
        }

        console.log(`📊 AR Invoices: ${arInvoices.length}, Web Orders: ${webOrders.length}`);

        // ============================================================
        // 2. Construir índices para lookup rápido
        // ============================================================

        // Índice Web Orders por order_code
        const woByOrderCode = new Map<string, any>();
        const woByEmail = new Map<string, any[]>();
        const woByCompany = new Map<string, any[]>();
        const woByName = new Map<string, any[]>();

        for (const wo of webOrders) {
            const cd = wo.custom_data || {};

            // Por order_code
            const oc = cd.order_code || cd.ecomm_order_number;
            if (oc) woByOrderCode.set(String(oc).toLowerCase(), wo);

            // Por email (pode ter vários com mesmo email)
            const email = normalize(cd.customer_email || wo.customer_email);
            if (email) {
                if (!woByEmail.has(email)) woByEmail.set(email, []);
                woByEmail.get(email)!.push(wo);
            }

            // Por company
            const comp = normalize(cd.company_name || cd.company);
            if (comp) {
                if (!woByCompany.has(comp)) woByCompany.set(comp, []);
                woByCompany.get(comp)!.push(wo);
            }

            // Por customer name
            const name = normalize(`${cd.customer_firstname || ''} ${cd.customer_lastname || ''}`);
            if (name) {
                if (!woByName.has(name)) woByName.set(name, []);
                woByName.get(name)!.push(wo);
            }
        }

        // ============================================================
        // 3. Matching em 4 níveis
        // ============================================================
        const matches: MatchResult[] = [];
        const matchedArIds = new Set<string>();
        const matchedWoIds = new Set<string>();

        // ----- Nível 1: Match EXATO por order_id ↔ order_code -----
        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const orderId = ar.order_id;
            if (!orderId) continue;

            const wo = woByOrderCode.get(String(orderId).toLowerCase());
            if (wo && !matchedWoIds.has(wo.id)) {
                matches.push({
                    ar_invoice_id: ar.id,
                    csv_row_id: wo.id,
                    match_type: 'order_id',
                    confidence: 1.0,
                    enriched_fields_ar: [],
                    enriched_fields_csv: [],
                });
                matchedArIds.add(ar.id);
                matchedWoIds.add(wo.id);
            }
        }
        console.log(`🔑 Nível 1 (order_id): ${matches.length} matches`);

        // ----- Nível 2: Match por email + amount (±0.01) -----
        const level2Start = matches.length;
        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const email = normalize(ar.email);
            if (!email) continue;

            const candidates = woByEmail.get(email) || [];
            for (const wo of candidates) {
                if (matchedWoIds.has(wo.id)) continue;
                if (amountsMatch(ar.total_amount, wo.amount)) {
                    matches.push({
                        ar_invoice_id: ar.id,
                        csv_row_id: wo.id,
                        match_type: 'email_amount',
                        confidence: 0.95,
                        enriched_fields_ar: [],
                        enriched_fields_csv: [],
                    });
                    matchedArIds.add(ar.id);
                    matchedWoIds.add(wo.id);
                    break; // 1:1 match
                }
            }
        }
        console.log(`📧 Nível 2 (email+amount): ${matches.length - level2Start} matches`);

        // ----- Nível 3: Match por company + amount + date (±3 dias) -----
        const level3Start = matches.length;
        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const comp = normalize(ar.company_name);
            if (!comp) continue;

            const candidates = woByCompany.get(comp) || [];
            for (const wo of candidates) {
                if (matchedWoIds.has(wo.id)) continue;
                if (amountsMatch(ar.total_amount, wo.amount) &&
                    datesWithinDays(ar.invoice_date || ar.order_date, wo.date, 3)) {
                    matches.push({
                        ar_invoice_id: ar.id,
                        csv_row_id: wo.id,
                        match_type: 'company_amount_date',
                        confidence: 0.85,
                        enriched_fields_ar: [],
                        enriched_fields_csv: [],
                    });
                    matchedArIds.add(ar.id);
                    matchedWoIds.add(wo.id);
                    break;
                }
            }
        }
        console.log(`🏢 Nível 3 (company+amount+date): ${matches.length - level3Start} matches`);

        // ----- Nível 4: Match por client_name + amount + date (±3 dias) -----
        const level4Start = matches.length;
        for (const ar of arInvoices) {
            if (matchedArIds.has(ar.id)) continue;
            const name = normalize(ar.client_name);
            if (!name) continue;

            // Buscar em todos os WOs por fuzzy name match
            let bestMatch: any = null;
            let bestSimilarity = 0;
            for (const wo of webOrders) {
                if (matchedWoIds.has(wo.id)) continue;
                const cd = wo.custom_data || {};
                const woName = `${cd.customer_firstname || ''} ${cd.customer_lastname || ''}`.trim();
                if (!woName) continue;

                const sim = nameSimilarity(ar.client_name, woName);
                if (sim >= 0.7 &&
                    amountsMatch(ar.total_amount, wo.amount) &&
                    datesWithinDays(ar.invoice_date || ar.order_date, wo.date, 3) &&
                    sim > bestSimilarity) {
                    bestMatch = wo;
                    bestSimilarity = sim;
                }
            }
            if (bestMatch) {
                matches.push({
                    ar_invoice_id: ar.id,
                    csv_row_id: bestMatch.id,
                    match_type: 'name_amount_date',
                    confidence: Math.round(bestSimilarity * 100) / 100,
                    enriched_fields_ar: [],
                    enriched_fields_csv: [],
                });
                matchedArIds.add(ar.id);
                matchedWoIds.add(bestMatch.id);
            }
        }
        console.log(`👤 Nível 4 (name+amount+date): ${matches.length - level4Start} matches`);
        console.log(`📊 Total matches: ${matches.length}`);

        // ============================================================
        // 4. Enriquecimento mútuo
        // ============================================================
        const arMap = new Map<string, any>();
        arInvoices.forEach(ar => arMap.set(ar.id, ar));
        const woMap = new Map<string, any>();
        webOrders.forEach(wo => woMap.set(wo.id, wo));

        const arUpdates: any[] = [];
        const woUpdates: any[] = [];

        for (const match of matches) {
            const ar = arMap.get(match.ar_invoice_id);
            const wo = woMap.get(match.csv_row_id);
            if (!ar || !wo) continue;

            const cd = wo.custom_data || {};
            const arUpdate: Record<string, any> = {};
            const woCustomUpdate: Record<string, any> = {};

            // ----- Enriquecer AR Invoice com dados do Web Order -----

            // Email
            if (!ar.email && (cd.customer_email || wo.customer_email)) {
                arUpdate.email = cd.customer_email || wo.customer_email;
                match.enriched_fields_ar.push('email');
            }

            // Client name 
            if (!ar.client_name) {
                const name = `${cd.customer_firstname || ''} ${cd.customer_lastname || ''}`.trim();
                if (name) {
                    arUpdate.client_name = name;
                    match.enriched_fields_ar.push('client_name');
                }
            }

            // Company
            if (!ar.company_name && (cd.company_name || cd.company)) {
                arUpdate.company_name = cd.company_name || cd.company;
                match.enriched_fields_ar.push('company_name');
            }

            // Products
            if (!ar.products && cd.product_name) {
                arUpdate.products = cd.product_name;
                match.enriched_fields_ar.push('products');
            }

            // Order ID
            if (!ar.order_id && (cd.order_code || cd.ecomm_order_number)) {
                arUpdate.order_id = cd.order_code || cd.ecomm_order_number;
                match.enriched_fields_ar.push('order_id');
            }

            // Payment method
            if (!ar.payment_method && cd.gateway_name) {
                arUpdate.payment_method = cd.gateway_name;
                match.enriched_fields_ar.push('payment_method');
            }

            // Billing entity
            if (!ar.billing_entity && cd.order_site) {
                arUpdate.billing_entity = cd.order_site;
                match.enriched_fields_ar.push('billing_entity');
            }

            // Charged amount (total_payment)
            if (!ar.charged_amount && cd.total_payment) {
                arUpdate.charged_amount = parseFloat(String(cd.total_payment));
                match.enriched_fields_ar.push('charged_amount');
            }

            // Discount code
            if (!ar.discount_code && cd.coupon_code) {
                arUpdate.discount_code = cd.coupon_code;
                match.enriched_fields_ar.push('discount_code');
            }

            // Order date
            if (!ar.order_date && (cd.date_ordered || wo.date)) {
                arUpdate.order_date = cd.date_ordered || wo.date;
                match.enriched_fields_ar.push('order_date');
            }

            // Source data (guardar custom_data completo para referência)
            if (!ar.source_data && Object.keys(cd).length > 0) {
                arUpdate.source_data = cd;
                match.enriched_fields_ar.push('source_data');
            }

            // ----- Enriquecer Web Order (csv_rows) com dados da AR Invoice -----

            // Invoice number
            if (!cd.invoice_number && ar.invoice_number) {
                woCustomUpdate.invoice_number = ar.invoice_number;
                match.enriched_fields_csv.push('invoice_number');
            }

            // Billing entity
            if (!cd.billing_entity && ar.billing_entity) {
                woCustomUpdate.billing_entity = ar.billing_entity;
                match.enriched_fields_csv.push('billing_entity');
            }

            // Payment method
            if (!cd.payment_method && ar.payment_method) {
                woCustomUpdate.payment_method = ar.payment_method;
                match.enriched_fields_csv.push('payment_method');
            }

            // Company (se WO não tem mas AR tem)
            if (!cd.company_name && !cd.company && ar.company_name) {
                woCustomUpdate.company_name = ar.company_name;
                match.enriched_fields_csv.push('company_name');
            }

            // Email (se WO não tem mas AR tem)
            if (!cd.customer_email && !wo.customer_email && ar.email) {
                woCustomUpdate.customer_email = ar.email;
                match.enriched_fields_csv.push('customer_email');
            }

            // Cross-reference IDs
            woCustomUpdate.ar_invoice_id = ar.id;
            woCustomUpdate.ar_invoice_number = ar.invoice_number;
            woCustomUpdate.cross_referenced_at = new Date().toISOString();

            // Acumular updates
            if (Object.keys(arUpdate).length > 0) {
                arUpdates.push({ id: ar.id, ...arUpdate });
            }

            if (Object.keys(woCustomUpdate).length > 0) {
                woUpdates.push({
                    id: wo.id,
                    custom_data: { ...cd, ...woCustomUpdate },
                    // Também atualizar customer_email e customer_name top-level se enriquecidos
                    ...(woCustomUpdate.customer_email ? { customer_email: woCustomUpdate.customer_email } : {}),
                });
            }
        }

        // ============================================================
        // 5. Aplicar updates (se não é dry-run)
        // ============================================================
        let arUpdated = 0;
        let woUpdated = 0;
        const enrichmentStats = {
            ar: {} as Record<string, number>,
            csv: {} as Record<string, number>,
        };

        // Contabilizar campos enriquecidos
        for (const m of matches) {
            for (const f of m.enriched_fields_ar) {
                enrichmentStats.ar[f] = (enrichmentStats.ar[f] || 0) + 1;
            }
            for (const f of m.enriched_fields_csv) {
                enrichmentStats.csv[f] = (enrichmentStats.csv[f] || 0) + 1;
            }
        }

        if (!dryRun) {
            // Atualizar AR Invoices em batches
            for (const upd of arUpdates) {
                const { id, ...fields } = upd;
                const { error } = await supabaseAdmin
                    .from("ar_invoices")
                    .update(fields)
                    .eq("id", id);
                if (!error) arUpdated++;
                else console.error(`❌ AR update ${id}:`, error.message);
            }

            // Atualizar Web Orders (csv_rows) em batches
            for (const upd of woUpdates) {
                const { id, ...fields } = upd;
                const { error } = await supabaseAdmin
                    .from("csv_rows")
                    .update(fields)
                    .eq("id", id);
                if (!error) woUpdated++;
                else console.error(`❌ WO update ${id}:`, error.message);
            }

            console.log(`✅ Cross-reference aplicado: ${arUpdated} AR invoices, ${woUpdated} Web Orders atualizados`);
        }

        // ============================================================
        // 6. Relatório
        // ============================================================
        const matchesByType = {
            order_id: matches.filter(m => m.match_type === 'order_id').length,
            email_amount: matches.filter(m => m.match_type === 'email_amount').length,
            company_amount_date: matches.filter(m => m.match_type === 'company_amount_date').length,
            name_amount_date: matches.filter(m => m.match_type === 'name_amount_date').length,
        };

        const unmatchedAr = arInvoices.length - matchedArIds.size;
        const unmatchedWo = webOrders.length - matchedWoIds.size;

        // Verificar que invoices não-matched são de Excel (source != hubspot)
        const unmatchedExcel = arInvoices.filter(ar => !matchedArIds.has(ar.id) && ar.source !== 'hubspot').length;
        const unmatchedHubspot = arInvoices.filter(ar => !matchedArIds.has(ar.id) && ar.source === 'hubspot').length;

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                arInvoicesTotal: arInvoices.length,
                webOrdersTotal: webOrders.length,
                totalMatches: matches.length,
                matchesByType,
                unmatchedArInvoices: unmatchedAr,
                unmatchedArExcel: unmatchedExcel,
                unmatchedArHubspot: unmatchedHubspot,
                unmatchedWebOrders: unmatchedWo,
            },
            enrichment: {
                arInvoicesUpdated: dryRun ? arUpdates.length : arUpdated,
                webOrdersUpdated: dryRun ? woUpdates.length : woUpdated,
                arFieldsEnriched: enrichmentStats.ar,
                csvFieldsEnriched: enrichmentStats.csv,
            },
            // Em dry-run, incluir sample dos matches para revisão
            ...(dryRun ? {
                sampleMatches: matches.slice(0, 20).map(m => ({
                    ...m,
                    ar_invoice: (() => {
                        const ar = arMap.get(m.ar_invoice_id);
                        return {
                            invoice_number: ar?.invoice_number,
                            client_name: ar?.client_name,
                            email: ar?.email,
                            total_amount: ar?.total_amount,
                            source: ar?.source,
                        };
                    })(),
                    web_order: (() => {
                        const wo = woMap.get(m.csv_row_id);
                        const cd = wo?.custom_data || {};
                        return {
                            order_code: cd.order_code,
                            customer_email: cd.customer_email,
                            customer_name: `${cd.customer_firstname || ''} ${cd.customer_lastname || ''}`.trim(),
                            amount: wo?.amount,
                        };
                    })(),
                })),
            } : {}),
        });

    } catch (err: any) {
        console.error('❌ [cross-ref] Erro:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// GET: relatório rápido do estado de cross-reference
export async function GET() {
    try {
        // Contar ar_invoices por source
        const { count: totalAr } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true });
        const { count: arHubspot } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).eq("source", "hubspot");
        const { count: arExcel } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).neq("source", "hubspot");

        // Contar gaps
        const { count: missingEmail } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).or("email.is.null,email.eq.");
        const { count: missingCompany } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).or("company_name.is.null,company_name.eq.");
        const { count: missingProducts } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).or("products.is.null,products.eq.");
        const { count: missingOrderId } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).or("order_id.is.null,order_id.eq.");
        const { count: missingPayment } = await supabaseAdmin
            .from("ar_invoices").select("*", { count: "exact", head: true }).or("payment_method.is.null,payment_method.eq.");

        const { count: totalWo } = await supabaseAdmin
            .from("csv_rows").select("*", { count: "exact", head: true }).eq("source", "hubspot");

        return NextResponse.json({
            success: true,
            arInvoices: {
                total: totalAr,
                fromHubspot: arHubspot,
                fromExcel: arExcel,
                gaps: {
                    email: missingEmail,
                    company_name: missingCompany,
                    products: missingProducts,
                    order_id: missingOrderId,
                    payment_method: missingPayment,
                },
            },
            webOrders: {
                total: totalWo,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
