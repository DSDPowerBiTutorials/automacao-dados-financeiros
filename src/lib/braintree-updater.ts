import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface BraintreeTransaction {
    transaction_id: string;
    status?: string;
    disbursement_id?: string | null;
    disbursement_date?: string | null;
    settlement_amount?: number | null;
    settlement_batch_id?: string | null; // 🆕 Settlement Batch ID
    created_at?: string;
    amount?: number;
    customer_name?: string;
    payment_method?: string;
    type?: string;
    [key: string]: any;
}

interface UpsertResult {
    success: boolean;
    action: "created" | "updated" | "skipped";
    reason?: string;
    preservedReconciliation?: boolean;
}

interface UpsertOptions {
    preserveReconciliation?: boolean;
    skipIfConciliado?: boolean;
}

/**
 * Atualiza transação existente ou cria nova se não existir
 */
export async function upsertBraintreeTransaction(
    transaction: BraintreeTransaction,
    source: string = "braintree-api-revenue",
    options: UpsertOptions = {}
): Promise<UpsertResult> {
    const { preserveReconciliation = true, skipIfConciliado = true } = options;

    try {
        if (!transaction.transaction_id) {
            return { success: false, action: "skipped", reason: "Missing transaction_id" };
        }

        // 1. Buscar transação existente pelo transaction_id
        const { data: existingRows, error: searchError } = await supabaseAdmin
            .from("csv_rows")
            .select("*")
            .eq("custom_data->>transaction_id", transaction.transaction_id)
            .or(`source.eq.${source},source.eq.braintree-api-revenue,source.like.braintree-api-%`)
            .limit(1);

        if (searchError) {
            console.error("[Braintree Updater] Search error:", searchError);
            return { success: false, action: "skipped", reason: searchError.message };
        }

        const existingRow = existingRows && existingRows.length > 0 ? existingRows[0] : null;

        // 2. Se não existe, criar nova
        if (!existingRow) {
            const newRow = {
                source,
                date: transaction.disbursement_date || transaction.created_at || new Date().toISOString().split('T')[0],
                description: formatDescription(transaction),
                amount: (transaction.settlement_amount || transaction.amount || 0).toString(),
                custom_data: {
                    ...transaction,
                    created_at: new Date().toISOString(),
                },
            };

            const { error: insertError } = await supabaseAdmin
                .from("csv_rows")
                .insert([newRow]);

            if (insertError) {
                console.error("[Braintree Updater] Insert error:", insertError);
                return { success: false, action: "skipped", reason: insertError.message };
            }

            console.log(`✅ [Braintree Updater] Created ${transaction.transaction_id}`);
            return { success: true, action: "created" };
        }

        // 3. Verificar se já está conciliado
        const isConciliado = existingRow.conciliado === true;

        if (isConciliado && skipIfConciliado) {
            console.log(`⚠️ [Braintree Updater] Skipped ${transaction.transaction_id}: Already reconciled`);
            return {
                success: true,
                action: "skipped",
                reason: "Already reconciled",
                preservedReconciliation: true,
            };
        }

        // 4. Verificar mudanças
        const hasChanges =
            existingRow.custom_data?.status !== transaction.status ||
            existingRow.custom_data?.disbursement_id !== transaction.disbursement_id ||
            existingRow.custom_data?.disbursement_date !== transaction.disbursement_date ||
            existingRow.custom_data?.settlement_amount !== transaction.settlement_amount ||
            existingRow.custom_data?.settlement_batch_id !== transaction.settlement_batch_id; // 🆕

        if (!hasChanges) {
            return { success: true, action: "skipped", reason: "No changes detected" };
        }

        // 5. Atualizar preservando reconciliação se necessário
        const updatedCustomData = {
            ...existingRow.custom_data,
            ...transaction,
            updated_at: new Date().toISOString(),
            last_update_reason: detectUpdateReason(existingRow.custom_data, transaction),
        };

        // Preservar dados de reconciliação se flag ativa e já conciliado
        if (preserveReconciliation && isConciliado) {
            updatedCustomData.conciliado = existingRow.conciliado;
            updatedCustomData.destinationAccount = existingRow.destinationAccount;
            updatedCustomData.reconciliationType = existingRow.reconciliationType;
        }

        const { error: updateError } = await supabaseAdmin
            .from("csv_rows")
            .update({
                custom_data: updatedCustomData,
                conciliado: preserveReconciliation && isConciliado ? existingRow.conciliado : false,
                destinationAccount: preserveReconciliation && isConciliado ? existingRow.destinationAccount : null,
                reconciliationType: preserveReconciliation && isConciliado ? existingRow.reconciliationType : null,
                date: transaction.disbursement_date || existingRow.date,
                description: formatDescription(transaction),
                amount: transaction.settlement_amount?.toString() || existingRow.amount,
            })
            .eq("id", existingRow.id);

        if (updateError) {
            console.error("[Braintree Updater] Update error:", updateError);
            return { success: false, action: "skipped", reason: updateError.message };
        }

        console.log(`✅ [Braintree Updater] Updated ${transaction.transaction_id}${isConciliado && preserveReconciliation ? " (reconciliation preserved)" : ""}`);
        return {
            success: true,
            action: "updated",
            preservedReconciliation: isConciliado && preserveReconciliation,
        };

    } catch (error: any) {
        console.error("[Braintree Updater] Unexpected error:", error);
        return { success: false, action: "skipped", reason: error.message };
    }
}

/**
 * Processa lote de transações
 */
export async function batchUpsertTransactions(
    transactions: BraintreeTransaction[],
    source: string = "braintree-api-revenue",
    options: UpsertOptions = {}
): Promise<{
    success: number;
    failed: number;
    updated: number;
    created: number;
    skipped: number;
    reconciled_preserved: number;
}> {
    const results = {
        success: 0,
        failed: 0,
        updated: 0,
        created: 0,
        skipped: 0,
        reconciled_preserved: 0,
    };

    for (const transaction of transactions) {
        const result = await upsertBraintreeTransaction(transaction, source, options);

        if (result.success) {
            results.success++;
            if (result.action === "updated") {
                results.updated++;
            } else if (result.action === "created") {
                results.created++;
            } else if (result.action === "skipped") {
                results.skipped++;
            }

            if (result.preservedReconciliation) {
                results.reconciled_preserved++;
            }
        } else {
            results.failed++;
        }
    }

    console.log(`[Braintree Batch Upsert] Results:`, results);
    return results;
}

/**
 * Detecta motivo da atualização
 */
function detectUpdateReason(oldData: any, newData: BraintreeTransaction): string {
    const reasons: string[] = [];

    if (oldData?.status !== newData.status) {
        reasons.push(`status: ${oldData?.status} → ${newData.status}`);
    }

    if (oldData?.disbursement_id !== newData.disbursement_id && newData.disbursement_id) {
        reasons.push(`disbursement added`);
    }

    if (oldData?.disbursement_date !== newData.disbursement_date && newData.disbursement_date) {
        reasons.push(`disbursement_date set`);
    }

    if (oldData?.settlement_amount !== newData.settlement_amount) {
        reasons.push(`settlement updated`);
    }

    return reasons.join(", ") || "data updated";
}

/**
 * Formata descrição da transação
 */
function formatDescription(transaction: BraintreeTransaction): string {
    const parts = [];

    if (transaction.customer_name) {
        parts.push(transaction.customer_name);
    }

    if (transaction.payment_method) {
        parts.push(transaction.payment_method);
    }

    if (transaction.type) {
        parts.push(transaction.type);
    }

    return parts.join(" - ") || transaction.transaction_id || "Braintree Transaction";
}

/**
 * Salva timestamp do último sync
 */
export async function saveLastSyncTimestamp(
    type: "automatic" | "safe" | "force"
): Promise<void> {
    try {
        const { error } = await supabaseAdmin
            .from("sync_metadata")
            .upsert({
                source: `braintree-${type}-update`,
                last_sync_date: new Date().toISOString(),
                status: "completed",
            }, {
                onConflict: "source",
            });

        if (error) {
            console.error(`[Braintree Updater] Failed to save ${type} sync timestamp:`, error);
        }
    } catch (error) {
        console.error(`[Braintree Updater] Error saving ${type} sync timestamp:`, error);
    }
}

/**
 * Busca timestamp do último sync
 */
export async function getLastSyncTimestamps(): Promise<{
    automatic: string | null;
    safe: string | null;
    force: string | null;
}> {
    try {
        const { data, error } = await supabase
            .from("sync_metadata")
            .select("source, last_sync_date")
            .in("source", ["braintree-automatic-update", "braintree-safe-update", "braintree-force-update"]);

        if (error) {
            console.error("[Braintree Updater] Failed to fetch sync timestamps:", error);
            return { automatic: null, safe: null, force: null };
        }

        const timestamps = {
            automatic: null as string | null,
            safe: null as string | null,
            force: null as string | null,
        };

        data?.forEach((row) => {
            if (row.source === "braintree-automatic-update") {
                timestamps.automatic = row.last_sync_date;
            } else if (row.source === "braintree-safe-update") {
                timestamps.safe = row.last_sync_date;
            } else if (row.source === "braintree-force-update") {
                timestamps.force = row.last_sync_date;
            }
        });

        return timestamps;
    } catch (error) {
        console.error("[Braintree Updater] Error fetching sync timestamps:", error);
        return { automatic: null, safe: null, force: null };
    }
}
