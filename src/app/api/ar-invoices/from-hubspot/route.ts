import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Rota para transferir csv_rows(hubspot) → ar_invoices
// Usada pelo cron diário (step 4b) para popular ar_invoices
// ============================================================

// Mapeamento de dealstage IDs para nomes legíveis
const STAGE_MAPPING: Record<string, string> = {
    'checkout_completed': 'Web Order',
    'checkout_pending': 'Credit Order',
    'cancelled': 'Cancelled',
    'closedwon': 'Web Order',
    '108197790': 'New',
    '108197794': 'Web Order',
    '206173276': 'Web Order',
    '1031801652': 'Credit Order',
    '1031823104': 'Credit Order',
    '1203581030': 'New',
    '1203581031': 'New',
    '1203581032': 'New',
    '1203581033': 'New',
    '1203581035': 'Web Order',
    '1203581036': 'Cancelled',
    '1067293738': 'Subscription Plan',
    '1065782346': 'Subscription Plan',
    '1065782348': 'Credit Order',
    '1065782349': 'Cancelled',
    '1065782350': 'Subscription Plan',
    '1026647932': 'New',
    '1026592320': 'Web Order',
    '22796161': 'New',
};

function getDealStatus(stageId: string | undefined, paidStatus: string | undefined): string {
    if (!stageId) return 'New';
    const stage = stageId.toString();
    const paid = (paidStatus || '').toLowerCase();
    if (stage === 'cancelled' || stage === '1203581036' || stage === '1065782349') return 'Cancelled';
    if (stage === '1031801652' || stage === 'checkout_pending' || stage === '1031823104' || stage === '1065782348') return 'Credit Order';
    if (stage === 'checkout_completed' || stage === 'closedwon' || stage === '108197794' || stage === '206173276' || stage === '1203581035' || stage === '1026592320') return 'Web Order';
    if (stage === '1067293738' || stage === '1065782346' || stage === '1065782350') return 'Subscription Plan';
    if (paid === 'paid') return 'Web Order';
    if (paid === 'partial' || paid === 'unpaid') return 'Credit Order';
    return STAGE_MAPPING[stage] || 'New';
}

function mapStatus(paidStatus: string | undefined): string {
    if (!paidStatus) return "pending";
    const s = paidStatus.toLowerCase();
    if (s === "paid" || s.includes("paid")) return "paid";
    if (s === "partial") return "partial";
    return "pending";
}

export async function POST(req: NextRequest) {
    try {
        console.log('🔄 [from-hubspot] Sincronizando csv_rows → ar_invoices...');

        // Buscar TODOS os csv_rows do HubSpot (paginado)
        let allRows: any[] = [];
        let offset = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", "hubspot")
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows = allRows.concat(data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        console.log(`📦 Total csv_rows hubspot: ${allRows.length}`);

        // Filtrar: data >= 2025-12-01, não TEST_, ecommerce_deal != false
        const minDate = new Date('2025-12-01');
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const validRows = allRows.filter(row => {
            const cd = row.custom_data || {};
            const dateStr = cd.date_ordered || cd.date_paid || row.date;
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (d < minDate || d > today) return false;
            const dealname = (cd.dealname || "").toUpperCase();
            const orderCode = (cd.order_code || "").toUpperCase();
            if (dealname.startsWith('TEST_') || orderCode.startsWith('TEST_')) return false;
            if (cd.ecommerce_deal === false || cd.ecommerce_deal === "false") return false;
            return true;
        });

        console.log(`✅ ${validRows.length} orders válidas após filtros`);

        // Preservar reconciliações existentes
        const { data: existingRecords } = await supabaseAdmin
            .from("ar_invoices")
            .select("source_id, reconciled, reconciled_at, reconciled_with, reconciliation_type, reconciled_by, payment_reference")
            .eq("source", "hubspot");

        const existingRecon = new Map<string, any>();
        (existingRecords || []).forEach(rec => {
            if (rec.reconciled) {
                existingRecon.set(rec.source_id, {
                    reconciled: rec.reconciled,
                    reconciled_at: rec.reconciled_at,
                    reconciled_with: rec.reconciled_with,
                    reconciliation_type: rec.reconciliation_type,
                    reconciled_by: rec.reconciled_by,
                    payment_reference: rec.payment_reference,
                });
            }
        });

        console.log(`🔒 Preservando ${existingRecon.size} reconciliações`);

        // Deletar registros hubspot existentes
        await supabaseAdmin.from("ar_invoices").delete().eq("source", "hubspot");

        // Mapear csv_rows → ar_invoices
        const invoices = validRows.map(row => {
            const cd = row.custom_data || {};
            const sourceId = String(row.id);
            const shortId = sourceId.replace(/-/g, '').slice(0, 12).toUpperCase();
            const orderCode = cd.order_code || null;
            const invoiceDate = cd.date_paid || cd.date_ordered || row.date;

            const firstName = cd.customer_firstname || "";
            const lastName = cd.customer_lastname || "";
            const clientName = `${firstName} ${lastName}`.trim() || null;

            // Extrair nome do produto
            let productName = cd.product_name && cd.product_name !== cd.order_code
                ? cd.product_name : null;
            if (!productName && cd.dealname) {
                let name = String(cd.dealname);
                name = name.replace(/^(PM|TA|WIN BACK STRATEGY|CHECKOUT PENDING|CONTACT US COURSES)\s*-?\s*/i, '');
                name = name.replace(/\s*-\s*[^\s]+@[^\s]+\s*(ROW|AMEX|APAC)?$/i, '');
                if (!/^[a-f0-9]{6,8}$/i.test(name.trim())) productName = name;
            }

            const recon = existingRecon.get(sourceId);

            const base: any = {
                invoice_number: `HS-${shortId}`,
                order_id: orderCode,
                order_date: cd.date_ordered || row.date || null,
                order_status: cd.paid_status || null,
                deal_status: getDealStatus(cd.dealstage as string, cd.paid_status as string),
                invoice_date: invoiceDate,
                products: productName,
                company_name: cd.company_name || cd.company || null,
                client_name: clientName,
                email: cd.customer_email || null,
                total_amount: parseFloat(String(cd.final_price || cd.total_price || row.amount)) || 0,
                currency: cd.currency || "EUR",
                charged_amount: cd.total_payment ? parseFloat(String(cd.total_payment)) : null,
                payment_method: cd.gateway_name || cd.payment_method || null,
                billing_entity: cd.order_site || null,
                discount_code: cd.coupon_code || null,
                note: cd.product_description || null,
                status: mapStatus(cd.paid_status as string),
                country_code: cd.customer_country || cd.company_country || "ES",
                scope: "ES",
                source: "hubspot",
                source_id: sourceId,
                source_data: cd, // Guardar custom_data completo para referência
            };

            if (recon) {
                base.reconciled = recon.reconciled;
                base.reconciled_at = recon.reconciled_at;
                base.reconciled_with = recon.reconciled_with;
                base.reconciliation_type = recon.reconciliation_type;
                base.reconciled_by = recon.reconciled_by;
                base.payment_reference = recon.payment_reference;
            }

            return base;
        });

        // Inserir em batches
        const BATCH = 100;
        let created = 0;
        let reconPreserved = 0;
        for (let i = 0; i < invoices.length; i += BATCH) {
            const batch = invoices.slice(i, i + BATCH);
            const { error: insertErr } = await supabaseAdmin.from("ar_invoices").insert(batch);
            if (insertErr) {
                console.error(`❌ Erro batch ${i}:`, insertErr.message);
                throw insertErr;
            }
            created += batch.length;
            reconPreserved += batch.filter((b: any) => b.reconciled).length;
        }

        console.log(`✅ ${created} ar_invoices criadas (${reconPreserved} reconciliações preservadas)`);

        return NextResponse.json({
            success: true,
            created,
            reconciliationsPreserved: reconPreserved,
            skipped: allRows.length - validRows.length,
        });
    } catch (err: any) {
        console.error('❌ [from-hubspot] Erro:', err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
