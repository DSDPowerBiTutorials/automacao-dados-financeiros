/**
 * Sync HubSpot → ar_invoices (INCREMENTAL)
 * 
 * PRESERVA reconciliações existentes!
 * Usa UPSERT em vez de DELETE+INSERT
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeamento de IDs de estágio para nomes do backend
const STAGE_MAPPING = {
    'checkout_completed': 'Shipped',
    'checkout_pending': 'Outstanding Payment',
    'cancelled': 'Cancelled',
    'closedwon': 'Shipped',
    'presentationscheduled': 'New',
    '108197790': 'New',
    '108197794': 'Shipped',
    '206173276': 'Shipped',
    '1031801652': 'Credit Order',
    '1031823104': 'Outstanding Payment',
    '1203581030': 'New',
    '1203581031': 'New',
    '1203581032': 'New',
    '1203581033': 'New',
    '1203581035': 'Shipped',
    '1203581036': 'Cancelled',
    '1067293738': 'Subscription Plan',
    '1065782346': 'Subscription Plan',
    '1065782348': 'Outstanding Payment',
    '1065782349': 'Cancelled',
    '1065782350': 'Subscription Plan',
    '1026647932': 'New',
    '1026592320': 'Shipped',
    '22796161': 'New',
};

function getDealStatus(stageId, paidStatus, hsClosedWon) {
    if (!stageId) return null;
    const stage = stageId.toString();
    const paid = (paidStatus || '').toLowerCase();

    // Cancelled stages
    if (stage === 'cancelled' || stage === '1203581036' || stage === '1065782349') return 'Cancelled';

    // Credit Order - APENAS dealstage específico 1031801652
    if (stage === '1031801652') return 'Credit Order';

    // Shipped stages
    if (stage === 'checkout_completed' || stage === 'closedwon') return 'Shipped';

    // Outstanding Payment stages
    if (stage === 'checkout_pending' || stage === '1031823104' || stage === '1065782348') return 'Outstanding Payment';

    // Subscription Plan stages
    if (stage === '1067293738' || stage === '1065782346' || stage === '1065782350') return 'Subscription Plan';

    // Fallback baseado em paid_status (para outros stages como 108197790)
    if (paid === 'paid') return 'Shipped';
    if (paid === 'partial') return 'Outstanding Payment';
    if (paid === 'unpaid') return 'Outstanding Payment';

    return STAGE_MAPPING[stage] || 'New';
}

async function syncHubSpotIncremental() {
    console.log("🔄 Sincronizando HubSpot v6 (INCREMENTAL - PRESERVA RECONCILIAÇÕES)...\n");

    // 1. BUSCAR RECONCILIAÇÕES EXISTENTES ANTES DE QUALQUER COISA
    console.log("🔍 Buscando reconciliações existentes para preservar...");
    const { data: existingRecords, error: fetchError } = await supabase
        .from("ar_invoices")
        .select("source_id, reconciled, reconciled_at, reconciled_with, reconciliation_type, reconciled_by, payment_reference, is_reconciled, matched_transaction_id")
        .eq("source", "hubspot");

    if (fetchError) {
        console.log("❌ Erro ao buscar existentes:", fetchError.message);
        return;
    }

    // Criar mapa de source_id -> dados de reconciliação
    const reconciliationMap = new Map();
    (existingRecords || []).forEach(rec => {
        if (rec.source_id) {
            const isReconciled = rec.reconciled === true || rec.is_reconciled === true;
            if (isReconciled) {
                reconciliationMap.set(rec.source_id, {
                    reconciled: rec.reconciled,
                    reconciled_at: rec.reconciled_at,
                    reconciled_with: rec.reconciled_with,
                    reconciliation_type: rec.reconciliation_type,
                    reconciled_by: rec.reconciled_by,
                    payment_reference: rec.payment_reference,
                    is_reconciled: rec.is_reconciled,
                    matched_transaction_id: rec.matched_transaction_id
                });
            }
        }
    });

    console.log(`📊 ${existingRecords?.length || 0} registros existentes, ${reconciliationMap.size} reconciliados serão preservados\n`);

    // 2. Buscar TODOS os dados HubSpot (usar range para pegar mais de 1000)
    let hubspotOrders = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from("csv_rows")
            .select("*")
            .eq("source", "hubspot")
            .range(offset, offset + pageSize - 1);

        if (error) {
            console.log("❌ Erro:", error.message);
            return;
        }

        if (!data || data.length === 0) break;

        hubspotOrders = hubspotOrders.concat(data);
        console.log(`   Carregando... ${hubspotOrders.length} registros`);

        if (data.length < pageSize) break;
        offset += pageSize;
    }

    console.log(`📊 Total HubSpot orders em csv_rows: ${hubspotOrders?.length || 0}`);

    // 3. FILTRO DE DATA: >= 2025-12-01 e <= HOJE (não datas futuras!)
    const minDate = new Date('2025-12-01');
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let validOrders = hubspotOrders.filter(order => {
        const cd = order.custom_data || {};
        const dateStr = cd.date_ordered || cd.date_paid || order.date;
        if (!dateStr) return false;

        const orderDate = new Date(dateStr);

        // Excluir datas inválidas (antes de 2025-12-01 ou depois de HOJE)
        if (orderDate < minDate) return false;
        if (orderDate > today) return false;

        return true;
    });

    console.log(`📊 Após filtro de data (01/12/2025 - ${today.toISOString().split('T')[0]}): ${validOrders.length}`);

    // 4. FILTROS DE QUALIDADE - Apenas orders de e-commerce reais + Credit Orders
    const beforeFilter = validOrders.length;
    validOrders = validOrders.filter(order => {
        const cd = order.custom_data || {};
        const dealname = (cd.dealname || "").toUpperCase();
        const orderCode = (cd.order_code || "").toUpperCase();
        const dealstage = (cd.dealstage || "").toString();

        // Excluir TEST_ orders
        if (dealname.startsWith('TEST_') || orderCode.startsWith('TEST_')) {
            return false;
        }

        // Incluir Credit Orders mesmo que ecommerce_deal = false
        if (dealstage === '1031801652') {
            return true; // Credit Order - sempre incluir
        }

        // Excluir se ecommerce_deal = false (não é order de produção)
        if (cd.ecommerce_deal === false || cd.ecommerce_deal === "false") {
            return false;
        }

        return true;
    });

    console.log(`📊 Após filtros (TEST_ + ecommerce_deal, inclui Credit Orders): ${validOrders.length} (removidos: ${beforeFilter - validOrders.length})`);

    // 5. Funções auxiliares
    const mapStatus = (paidStatus) => {
        if (!paidStatus) return "pending";
        const status = paidStatus.toLowerCase();
        if (status === "paid" || status.includes("paid")) return "paid";
        if (status === "partial") return "partial";
        return "pending";
    };

    const extractOrderCode = (orderCode, dealname) => {
        if (orderCode && /^[a-f0-9]{7,8}$/i.test(orderCode)) return orderCode;
        const hashMatch = dealname?.match(/\b([a-f0-9]{7,8})\b/i);
        if (hashMatch) return hashMatch[1];
        return null;
    };

    const extractProductName = (cd) => {
        if (cd.product_name && cd.product_name !== cd.dealname && cd.product_name !== cd.order_code) {
            return cd.product_name;
        }
        let name = cd.dealname || "";
        if (/^[a-f0-9]{7,8}$/i.test(name)) return cd.product_name || name;
        name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
        name = name.replace(/\s+-\s+[A-Za-z\s]+\s+-\s+[a-f0-9]{7,8}$/i, '');
        name = name.replace(/\s+-\s+[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
        name = name.replace(/\s+-\s+[a-f0-9]{7,8}$/i, '');
        name = name.replace(/\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{4}/i, '');
        return name.trim() || cd.product_name || null;
    };

    // 6. Preparar registros COM PRESERVAÇÃO DE RECONCILIAÇÕES
    const records = validOrders.map((order) => {
        const cd = order.custom_data || {};
        const shortId = String(order.id).replace(/-/g, '').slice(0, 12).toUpperCase();
        const stageId = cd.stage || cd.dealstage;
        const sourceId = String(order.id);

        const baseRecord = {
            invoice_number: `HS-${shortId}`,
            order_id: extractOrderCode(cd.order_code, cd.dealname),
            order_date: cd.date_ordered || order.date || null,
            order_status: cd.paid_status || null,
            deal_status: getDealStatus(stageId, cd.paid_status, cd.hs_is_closed_won),
            invoice_date: cd.date_paid || cd.date_ordered || order.date,
            products: extractProductName(cd),
            company_name: cd.company_name || cd.company || null,
            client_name: `${cd.customer_firstname || ""} ${cd.customer_lastname || ""}`.trim() || null,
            email: cd.customer_email || null,
            total_amount: parseFloat(cd.final_price || cd.total_price || order.amount) || 0,
            currency: cd.currency || "EUR",
            payment_method: cd.gateway_name || null,
            status: mapStatus(cd.paid_status),
            scope: "ES",
            source: "hubspot",
            source_id: sourceId
        };

        // PRESERVAR campos de reconciliação se existirem
        const existingRecon = reconciliationMap.get(sourceId);
        if (existingRecon) {
            baseRecord.reconciled = existingRecon.reconciled;
            baseRecord.reconciled_at = existingRecon.reconciled_at;
            baseRecord.reconciled_with = existingRecon.reconciled_with;
            baseRecord.reconciliation_type = existingRecon.reconciliation_type;
            baseRecord.reconciled_by = existingRecon.reconciled_by;
            baseRecord.payment_reference = existingRecon.payment_reference;
            baseRecord.is_reconciled = existingRecon.is_reconciled;
            baseRecord.matched_transaction_id = existingRecon.matched_transaction_id;
        }

        return baseRecord;
    });

    console.log(`\n📊 Registros a processar: ${records.length}`);

    // Estatísticas de deal_status
    const statusCounts = {};
    records.forEach(r => {
        const s = r.deal_status || 'null';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    console.log(`\n📊 Distribuição de deal_status:`);
    Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
        console.log(`   ${s}: ${c}`);
    });

    // Estatísticas de meses
    const monthCounts = {};
    records.forEach(r => {
        const d = r.order_date;
        if (d) {
            const month = d.substring(0, 7);
            monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
    });
    console.log(`\n📊 Distribuição por mês:`);
    Object.entries(monthCounts).sort().forEach(([m, c]) => {
        console.log(`   ${m}: ${c}`);
    });

    // 7. UPSERT em batches (NÃO DELETE!)
    const batchSize = 100;
    let upserted = 0;
    let preserved = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        const { error: upsertError } = await supabase
            .from("ar_invoices")
            .upsert(batch, {
                onConflict: 'source_id',
                ignoreDuplicates: false
            });

        if (upsertError) {
            console.log(`❌ Erro no batch ${i}:`, upsertError.message);
        } else {
            const batchPreserved = batch.filter(r => r.reconciled === true || r.is_reconciled === true).length;
            upserted += batch.length;
            preserved += batchPreserved;
        }
    }

    console.log(`\n🎉 CONCLUÍDO!`);
    console.log(`   ✅ ${upserted} registros processados (upsert)`);
    console.log(`   🔒 ${preserved} reconciliações preservadas`);
    console.log(`   📈 Sync incremental - dados existentes atualizados, não deletados`);
}

syncHubSpotIncremental();
