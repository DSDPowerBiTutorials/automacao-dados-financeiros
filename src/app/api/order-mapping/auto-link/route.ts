// API: Auto-linking automático de transações Braintree ↔ HubSpot Orders
// Roda via cron job (a cada hora) ou chamada manual
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutos

export async function GET(request: NextRequest) {
    try {
        console.log("[Auto-Link] Starting automatic linking...");

        const limit = 100; // Processar 100 por vez

        // 1. Buscar transações Braintree SEM hubspot_vid ou order_id
        const { data: unmappedTxs, error: txError } = await supabaseAdmin
            .from("csv_rows")
            .select("id, custom_data, amount, date, customer_email")
            .eq("source", "braintree-api-revenue")
            .or("custom_data->hubspot_vid.is.null,custom_data->order_id.is.null")
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

        console.log(`[Auto-Link] Found ${unmappedTxs.length} unmapped transactions`);

        const linked = [];
        const failed = [];

        // 2. Para cada transação, tentar encontrar Deal no HubSpot
        for (const tx of unmappedTxs) {
            try {
                const txId = tx.custom_data?.transaction_id;
                const customerEmail = tx.custom_data?.customer_email || tx.customer_email;
                const amount = tx.amount;
                const date = new Date(tx.date);

                if (!txId || !customerEmail) {
                    console.log(`[Auto-Link] Skipping ${txId}: missing email or tx_id`);
                    continue;
                }

                // 2.1 Buscar no HubSpot por email + valor próximo + data próxima
                const dateMin = new Date(date);
                dateMin.setDate(dateMin.getDate() - 7); // -7 dias
                const dateMax = new Date(date);
                dateMax.setDate(dateMax.getDate() + 7); // +7 dias

                const amountMin = amount * 0.95; // -5%
                const amountMax = amount * 1.05; // +5%

                const { data: hubspotDeals, error: hsError } = await supabaseAdmin
                    .from("csv_rows")
                    .select("id, custom_data, amount, date")
                    .eq("source", "hubspot-deals")
                    .eq("customer_email", customerEmail)
                    .gte("amount", amountMin)
                    .lte("amount", amountMax)
                    .gte("date", dateMin.toISOString().split("T")[0])
                    .lte("date", dateMax.toISOString().split("T")[0])
                    .limit(5);

                if (hsError || !hubspotDeals || hubspotDeals.length === 0) {
                    console.log(`[Auto-Link] No HubSpot deal found for ${txId}`);
                    failed.push({ txId, reason: "no_matching_deal" });
                    continue;
                }

                // 2.2 Pegar o primeiro match (mais próximo)
                const bestMatch = hubspotDeals[0];
                const hubspotVid = bestMatch.custom_data?.ID || bestMatch.id;
                const reference = bestMatch.custom_data?.reference || bestMatch.custom_data?.Reference;

                if (!hubspotVid || !reference) {
                    console.log(`[Auto-Link] Match found but missing vid/reference for ${txId}`);
                    failed.push({ txId, reason: "missing_reference" });
                    continue;
                }

                // 2.3 Atualizar transação Braintree com hubspot_vid e order_id
                const updatedCustomData = {
                    ...tx.custom_data,
                    hubspot_vid: hubspotVid,
                    order_id: reference,
                    linked_at: new Date().toISOString(),
                    auto_linked: true,
                };

                const { error: updateError } = await supabaseAdmin
                    .from("csv_rows")
                    .update({ custom_data: updatedCustomData })
                    .eq("id", tx.id);

                if (updateError) {
                    console.error(`[Auto-Link] Failed to update ${txId}:`, updateError);
                    failed.push({ txId, reason: updateError.message });
                    continue;
                }

                // 2.4 Criar mapeamento na tabela order_transaction_mapping
                await supabaseAdmin
                    .from("order_transaction_mapping")
                    .insert({
                        order_id: reference,
                        transaction_id: txId,
                        source: "auto_link",
                    })
                    .onConflict("transaction_id")
                    .ignore();

                linked.push({
                    transaction_id: txId,
                    order_id: reference,
                    hubspot_vid: hubspotVid,
                    amount,
                    customer_email: customerEmail,
                });

                console.log(`[Auto-Link] ✅ Linked ${txId} → ${reference}`);
            } catch (err: any) {
                console.error(`[Auto-Link] Error processing transaction:`, err);
                failed.push({ txId: tx.custom_data?.transaction_id, reason: err.message });
            }
        }

        console.log(`[Auto-Link] Completed: ${linked.length} linked, ${failed.length} failed`);

        return NextResponse.json({
            success: true,
            processed: unmappedTxs.length,
            linked: linked.length,
            failed: failed.length,
            linked_transactions: linked.slice(0, 10), // Primeiros 10
            failed_transactions: failed.slice(0, 10),
            message: `Successfully linked ${linked.length} transactions`,
        });
    } catch (error: any) {
        console.error("[Auto-Link] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Permitir POST também (para trigger manual via fetch)
export async function POST(request: NextRequest) {
    return GET(request);
}
