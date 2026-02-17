import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * API para reconciliar a cadeia completa:
 * Web Orders (ar_invoices) → Braintree Transactions → Disbursements → Bank
 * 
 * Query params:
 * - dryRun=true: apenas simula sem atualizar
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    try {
        // 1. Buscar todos os disbursements do Braintree
        const { data: disbursements, error: disbError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "braintree-api-disbursement")
            .order("date", { ascending: false });

        if (disbError) throw disbError;

        // 2. Buscar todas as transações Braintree com disbursement_date
        const { data: braintreeTxs, error: btError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "braintree-api-revenue")
            .not("custom_data->disbursement_date", "is", null);

        if (btError) throw btError;

        // 3. Buscar registros do banco Bankinter EUR (créditos do PayPal/Braintree)
        const { data: bankRows, error: bankError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("source", "bankinter-eur")
            .gt("amount", 0); // Créditos

        if (bankError) throw bankError;

        // 4. Buscar web orders do ar_invoices (HubSpot + Craft Commerce)
        const { data: webOrders, error: woError } = await supabaseAdmin
            .from("ar_invoices")
            .select("*")
            .in("source", ["hubspot", "craft-commerce"]);

        if (woError) throw woError;

        const results: {
            disbursementId: string;
            disbursementAmount: number;
            disbursementDate: string;
            bankRowId: number | null;
            bankMatch: boolean;
            transactionCount: number;
            webOrdersLinked: number;
            webOrderIds: string[];
        }[] = [];

        const updates: {
            arInvoiceUpdates: { id: number; source_data: Record<string, unknown> }[];
            csvRowUpdates: { id: number; reconciled: boolean; custom_data: Record<string, unknown> }[];
        } = {
            arInvoiceUpdates: [],
            csvRowUpdates: [],
        };

        // Processar cada disbursement
        for (const disb of disbursements || []) {
            const disbData = disb.custom_data as Record<string, unknown> || {};
            const transactionIds = (disbData.transaction_ids as string[]) || [];
            const disbAmount = disb.amount;
            const disbDate = disb.date;
            const disbId = (disbData.disbursement_id as string) || disb.id.toString();

            // Encontrar transações que pertencem a este disbursement
            // O campo correto é custom_data.transaction_id
            const linkedTxs = (braintreeTxs || []).filter(tx => {
                const txData = tx.custom_data as Record<string, unknown> || {};
                const txId = txData.transaction_id as string;
                return transactionIds.includes(txId);
            });

            // Encontrar web orders com order_id correspondente
            // ar_invoices tem campo direto order_id
            const orderIds = linkedTxs
                .map(tx => {
                    const txData = tx.custom_data as Record<string, unknown> || {};
                    return txData.order_id as string;
                })
                .filter(Boolean);

            const linkedWebOrders = (webOrders || []).filter(wo => {
                // Verificar campo order_id diretamente na tabela
                const woOrderId = wo.order_id as string | null;
                return woOrderId && orderIds.includes(woOrderId);
            });

            // Encontrar registro do banco com valor aproximado (tolerância de 0.10)
            const matchedBank = (bankRows || []).find(bank => {
                const diff = Math.abs(bank.amount - disbAmount);
                // Também verificar se a descrição contém PayPal (indicador de Braintree)
                const descMatch = bank.description?.toLowerCase().includes("paypal") ||
                    bank.description?.toLowerCase().includes("braintree");
                return diff < 0.10 && descMatch;
            });

            results.push({
                disbursementId: disbId,
                disbursementAmount: disbAmount,
                disbursementDate: disbDate,
                bankRowId: matchedBank?.id || null,
                bankMatch: !!matchedBank,
                transactionCount: linkedTxs.length,
                webOrdersLinked: linkedWebOrders.length,
                webOrderIds: orderIds,
            });

            // Se encontrou match com banco, preparar updates
            if (matchedBank) {
                // Update ar_invoices
                for (const wo of linkedWebOrders) {
                    const existingData = (wo.source_data as Record<string, unknown>) || {};
                    updates.arInvoiceUpdates.push({
                        id: wo.id,
                        source_data: {
                            ...existingData,
                            bank_reconciled: true,
                            disbursement_id: disbId,
                            disbursement_date: disbDate,
                            disbursement_amount: disbAmount,
                            bank_row_id: matchedBank.id,
                            reconciled_at: new Date().toISOString(),
                        },
                    });
                }

                // Update csv_rows (disbursement)
                updates.csvRowUpdates.push({
                    id: disb.id,
                    reconciled: true,
                    custom_data: {
                        ...disbData,
                        bank_matched: true,
                        bank_row_id: matchedBank.id,
                    },
                });

                // Update csv_rows (bank)
                const bankData = (matchedBank.custom_data as Record<string, unknown>) || {};
                updates.csvRowUpdates.push({
                    id: matchedBank.id,
                    reconciled: true,
                    custom_data: {
                        ...bankData,
                        disbursement_matched: true,
                        disbursement_id: disbId,
                        web_orders_count: linkedWebOrders.length,
                    },
                });
            }
        }

        // Se não for dry run, aplicar updates
        if (!dryRun && updates.arInvoiceUpdates.length > 0) {
            for (const upd of updates.arInvoiceUpdates) {
                await supabaseAdmin
                    .from("ar_invoices")
                    .update({ source_data: upd.source_data })
                    .eq("id", upd.id);
            }
        }

        if (!dryRun && updates.csvRowUpdates.length > 0) {
            for (const upd of updates.csvRowUpdates) {
                await supabaseAdmin
                    .from("csv_rows")
                    .update({ reconciled: upd.reconciled, custom_data: upd.custom_data })
                    .eq("id", upd.id);
            }
        }

        const summary = {
            dryRun,
            totalDisbursements: disbursements?.length || 0,
            totalBraintreeTxs: braintreeTxs?.length || 0,
            totalBankRows: bankRows?.length || 0,
            totalWebOrders: webOrders?.length || 0,
            matchedDisbursements: results.filter(r => r.bankMatch).length,
            unmatchedDisbursements: results.filter(r => !r.bankMatch).length,
            arInvoicesUpdated: updates.arInvoiceUpdates.length,
            csvRowsUpdated: updates.csvRowUpdates.length,
        };

        return NextResponse.json({
            success: true,
            summary,
            results,
            updates: dryRun ? updates : { applied: true },
        });
    } catch (error) {
        console.error("Reconciliation error:", error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
