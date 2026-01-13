// API: Backfill automático de vínculos via HubSpot + Email matching
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { dry_run = true, limit = 100 } = body;

        console.log(`[Backfill] Starting... (dry_run: ${dry_run}, limit: ${limit})`);

        // 1. Buscar transações SEM order_id mapeado
        const { data: unmappedTxs, error: txError } = await supabaseAdmin
            .from("csv_rows")
            .select("id, custom_data")
            .eq("source", "braintree-api-revenue")
            .is("custom_data->order_id", null)
            .limit(limit);

        if (txError) throw txError;

        if (!unmappedTxs || unmappedTxs.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No unmapped transactions found",
                processed: 0,
                linked: 0,
            });
        }

        console.log(`[Backfill] Found ${unmappedTxs.length} unmapped transactions`);

        const txIds = unmappedTxs
            .map((tx) => tx.custom_data?.transaction_id)
            .filter(Boolean);

        // 2. Verificar quais JÁ têm mapeamento na tabela
        const { data: existingMappings } = await supabaseAdmin
            .from("order_transaction_mapping")
            .select("transaction_id")
            .in("transaction_id", txIds);

        const existingTxIds = new Set(
            (existingMappings || []).map((m) => m.transaction_id)
        );

        const needsMapping = unmappedTxs.filter(
            (tx) => !existingTxIds.has(tx.custom_data?.transaction_id)
        );

        console.log(
            `[Backfill] ${needsMapping.length} need mapping (${existingTxIds.size} already mapped)`
        );

        // 3. Buscar vínculos no HubSpot
        const { data: hubspotLinks } = await supabaseAdmin
            .from("braintree_hubspot_order_links")
            .select("*")
            .in(
                "braintree_transaction_id",
                needsMapping.map((tx) => tx.custom_data?.transaction_id)
            );

        const hubspotMap = new Map();
        (hubspotLinks || []).forEach((link) => {
            if (link.hubspot_order_code) {
                hubspotMap.set(link.braintree_transaction_id, link.hubspot_order_code);
            }
        });

        console.log(`[Backfill] Found ${hubspotMap.size} HubSpot links`);

        // 4. Criar mapeamentos
        const toCreate = [];
        const linked = [];

        for (const tx of needsMapping) {
            const txId = tx.custom_data?.transaction_id;
            if (!txId) continue;

            const orderId = hubspotMap.get(txId);
            if (orderId) {
                toCreate.push({
                    order_id: orderId,
                    transaction_id: txId,
                    source: "hubspot_backfill",
                });
                linked.push({ txId, orderId });
            }
        }

        console.log(`[Backfill] Ready to create ${toCreate.length} mappings`);

        if (!dry_run && toCreate.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from("order_transaction_mapping")
                .insert(toCreate);

            if (insertError) {
                console.error("[Backfill] Insert error:", insertError);
                throw insertError;
            }

            console.log(`[Backfill] ✅ Created ${toCreate.length} mappings`);
        }

        return NextResponse.json({
            success: true,
            dry_run,
            processed: needsMapping.length,
            found_in_hubspot: hubspotMap.size,
            created: dry_run ? 0 : toCreate.length,
            sample_links: linked.slice(0, 10),
            message: dry_run
                ? `DRY RUN: Would create ${toCreate.length} mappings`
                : `Created ${toCreate.length} mappings successfully`,
        });
    } catch (error: any) {
        console.error("[Backfill] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
