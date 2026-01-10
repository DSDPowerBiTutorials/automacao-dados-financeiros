/**
 * API Route: Sincronização e update de transações do Braintree
 * 
 * Suporta dois modos:
 * 1. Legacy sync: Busca intervalo de datas (startDate/endDate)
 * 2. Update mode: Atualiza últimos X dias com upsert inteligente
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { updateSyncMetadata } from "@/lib/sync-metadata";
import {
  searchTransactions,
  calculateTransactionFee,
  getCustomerName,
  getPaymentMethod,
  type BraintreeTransactionData,
} from "@/lib/braintree";
import { batchUpsertTransactions, saveLastSyncTimestamp } from "@/lib/braintree-updater";
import braintree from "braintree";

/**
 * 🏦 SETTLEMENT DATE EXTRACTOR
 * 
 * Extrai a data precisa de quando o banco confirmou a transação (settlement).
 * Esta é a data em que o dinheiro oficialmente se torna seu (reduz risco de chargeback).
 * 
 * Prioridades:
 * 1. statusHistory - Busca entrada "settled" ou "settled_successfully" com timestamp
 * 2. updatedAt - Fallback se status é "settled" mas sem statusHistory
 * 3. null - Se transação ainda não está settled
 * 
 * @param transaction - Objeto da transação do Braintree
 * @returns ISO timestamp do settlement ou null
 */
function getSettlementDate(transaction: any): string | null {
  try {
    // 🔍 DEBUG: Log para investigação
    const shouldLog = Math.random() < 0.05; // Log 5% das transações
    if (shouldLog) {
      console.log(`[Settlement Date] Checking ${transaction.id}:`, {
        status: transaction.status,
        hasStatusHistory: !!transaction.statusHistory,
        statusHistoryLength: transaction.statusHistory?.length,
        updatedAt: transaction.updatedAt,
      });
    }

    // ✅ Prioridade 1: Buscar timestamp preciso no statusHistory
    if (transaction.statusHistory && Array.isArray(transaction.statusHistory)) {
      const settledEntry = transaction.statusHistory.find((entry: any) =>
        entry.status === "settled" ||
        entry.status === "settled_successfully" ||
        entry.status === "settling"
      );

      if (settledEntry && settledEntry.timestamp) {
        const settlementDate = typeof settledEntry.timestamp === 'string'
          ? new Date(settledEntry.timestamp)
          : settledEntry.timestamp;
        const result = settlementDate.toISOString();
        if (shouldLog) {
          console.log(`[Settlement Date] ✅ Found in statusHistory: ${result}`);
        }
        return result;
      }
    }

    // ✅ Prioridade 2: Fallback para updatedAt se status é settled
    if (transaction.status === "settled" || transaction.status === "settling") {
      const updatedAtDate = typeof transaction.updatedAt === 'string'
        ? new Date(transaction.updatedAt)
        : transaction.updatedAt;
      const result = updatedAtDate.toISOString();
      if (shouldLog) {
        console.log(`[Settlement Date] ⚠️ Using updatedAt fallback: ${result}`);
      }
      return result;
    }

    // ✅ Prioridade 3: Ainda não settled
    if (shouldLog) {
      console.log(`[Settlement Date] ❌ Not settled yet`);
    }
    return null;
  } catch (err) {
    console.error(`[Settlement Date] Error extracting for transaction ${transaction.id}:`, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      // Legacy mode
      startDate,
      endDate,
      currency = "EUR",
      // Update mode
      preserveReconciliation = true,
      skipIfConciliado = true,
      daysBack,
      updateType = "safe",
    } = body;

    // Se daysBack é fornecido, usar modo update
    if (daysBack !== undefined) {
      return handleUpdateMode({
        preserveReconciliation,
        skipIfConciliado,
        daysBack,
        updateType,
        currency,
      });
    }

    // Validações
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate e endDate são obrigatórios" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Datas inválidas. Use formato YYYY-MM-DD" },
        { status: 400 }
      );
    }

    console.log(
      `[Braintree Sync] Buscando transações de ${startDate} até ${endDate}`
    );
    console.log(`[Braintree Sync] Start Date Object:`, start);
    console.log(`[Braintree Sync] End Date Object:`, end);

    // Busca TODAS as transações (sem filtro de status)
    // Para ver tudo que existe no período
    const transactions = await searchTransactions(start, end);

    console.log(`[Braintree Sync] Encontradas ${transactions.length} transações`);

    if (transactions.length > 0) {
      console.log(`[Braintree Sync] Primeira transação:`, {
        id: transactions[0].id,
        amount: transactions[0].amount,
        status: transactions[0].status,
        createdAt: transactions[0].createdAt,
        merchantAccountId: transactions[0].merchantAccountId,
      });
    }

    const rowsToInsert: any[] = [];
    const feeRowsToInsert: any[] = [];

    // Processa cada transação
    for (const transaction of transactions) {
      // Detecta moeda da transação
      const txCurrency = transaction.currencyIsoCode || currency;

      // 1️⃣ RECEITA - Registro principal da transação (Contas a Receber)
      let transactionDate: Date;
      try {
        transactionDate = new Date(transaction.createdAt);
        if (isNaN(transactionDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (err) {
        console.error(`[Transaction Date] Error parsing createdAt for ${transaction.id}:`, err);
        continue; // Skip this transaction
      }

      // 🔑 GERAR SETTLEMENT BATCH ID
      // Formato: YYYY-MM-DD_merchantAccount_uniqueId
      let settlement_batch_id: string | null = null;
      let hasGeneratedBatch = false;
      try {
        const disbDetails = transaction.disbursementDetails;
        if (disbDetails?.disbursementDate) {
          const disbDate = new Date(disbDetails!.disbursementDate!);
          const dateStr = disbDate.toISOString().split('T')[0]; // YYYY-MM-DD
          const merchantAccount = transaction.merchantAccountId || 'unknown';
          const uniqueId = disbDetails!.disbursementId || transaction.id;
          settlement_batch_id = `${dateStr}_${merchantAccount}_${uniqueId}`;
          hasGeneratedBatch = true;

          // 🔍 DEBUG: Log settlement_batch_id generation (primeiras 5 e ensq9tm6)
          if (transactions.indexOf(transaction) < 5 || transaction.id === 'ensq9tm6') {
            console.log(`[DEBUG Settlement Batch] ✅ Generated for ${transaction.id}:`, {
              disbursementDate: disbDetails!.disbursementDate,
              disbursementId: disbDetails!.disbursementId,
              merchantAccount,
              settlement_batch_id,
            });
          }
        } else {
          // Log quando NÃO consegue gerar
          if (transactions.indexOf(transaction) < 5 || transaction.id === 'ensq9tm6') {
            console.log(`[DEBUG Settlement Batch] ❌ No disbursementDate for ${transaction.id}:`, {
              hasDisbursementDetails: !!transaction.disbursementDetails,
              status: transaction.status,
            });
          }
        }
      } catch (err) {
        console.error(`[Settlement Batch ID] Error generating for transaction ${transaction.id}:`, err);
      }
      const revenueRow = {
        // ✅ ID único com currency prefix para evitar colisões
        id: `braintree-rev-${txCurrency}-${transaction.id}`,
        file_name: "braintree-api-sync.csv",
        source: "braintree-api-revenue",
        date: transactionDate.toISOString().split("T")[0],
        description: `${getCustomerName(transaction)} - ${getPaymentMethod(transaction)}`,
        amount: parseFloat(transaction.amount),
        reconciled: false,

        // Dados customizados do Braintree (armazenados em custom_data JSONB)
        custom_data: {
          transaction_id: transaction.id,
          status: transaction.status,
          type: transaction.type,
          currency: txCurrency,
          customer_id: transaction.customer?.id,
          customer_name: getCustomerName(transaction),
          customer_email: transaction.customer?.email,
          payment_method: getPaymentMethod(transaction),
          merchant_account_id: transaction.merchantAccountId,
          created_at: (() => {
            try {
              // ✅ Fix: Safe date parsing (createdAt pode ser string ou Date)
              const createdAtDate = typeof transaction.createdAt === 'string'
                ? new Date(transaction.createdAt)
                : transaction.createdAt;
              return createdAtDate.toISOString();
            } catch (err) {
              console.error(`[Created At] Error for transaction ${transaction.id}:`, err);
              return new Date().toISOString(); // Fallback to now
            }
          })(),
          updated_at: (() => {
            try {
              const updatedAtDate = typeof transaction.updatedAt === 'string'
                ? new Date(transaction.updatedAt)
                : transaction.updatedAt;
              return updatedAtDate.toISOString();
            } catch (err) {
              console.error(`[Updated At] Error for transaction ${transaction.id}:`, err);
              return new Date().toISOString(); // Fallback to now
            }
          })(),

          // 💰 Campos de Disbursement (settlement/transferência bancária)
          disbursement_date: (() => {
            try {
              const disbDetails = transaction.disbursementDetails;
              return disbDetails?.disbursementDate
                ? new Date(disbDetails!.disbursementDate!).toISOString()
                : null;
            } catch (err) {
              console.error(`[Disbursement Date] Error for transaction ${transaction.id}:`, err);
              return null;
            }
          })(),
          settlement_amount: transaction.disbursementDetails?.settlementAmount || null,
          settlement_currency: transaction.disbursementDetails?.settlementCurrencyIsoCode || null,
          settlement_currency_iso_code: transaction.disbursementDetails?.settlementCurrencyIsoCode || null,
          settlement_currency_exchange_rate: (() => {
            try {
              const disbDetails = transaction.disbursementDetails;
              return disbDetails?.settlementCurrencyExchangeRate
                ? parseFloat(disbDetails!.settlementCurrencyExchangeRate!)
                : null;
            } catch (err) {
              console.error(`[Exchange Rate] Error for transaction ${transaction.id}:`, err);
              return null;
            }
          })(),

          // 🔑 ID do disbursement (agrupa transações pagas juntas no mesmo payout)
          disbursement_id: transaction.disbursementDetails?.disbursementId || null,

          // 🔑 Settlement Batch ID (formato: YYYY-MM-DD_merchantAccount_uniqueId)
          settlement_batch_id: settlement_batch_id,

          // 🏦 Settlement Date (data precisa de confirmação do banco)
          // Diferente de disbursement_date (quando dinheiro chega na conta)
          // Esta é a data em que o dinheiro oficialmente se torna seu
          settlement_date: getSettlementDate(transaction),

          // 📋 Status History (histórico completo de mudanças de status)
          status_history: (transaction as any).statusHistory || [],
        },
      };

      // 🔍 DEBUG: Log custom_data sendo salvo (primeiras 5 e ensq9tm6)
      if (rowsToInsert.length < 5 || transaction.id === 'ensq9tm6') {
        console.log(`[DEBUG Save] custom_data for ${transaction.id}:`, {
          settlement_batch_id: revenueRow.custom_data.settlement_batch_id,
          disbursement_id: revenueRow.custom_data.disbursement_id,
          disbursement_date: revenueRow.custom_data.disbursement_date,
          merchant_account_id: revenueRow.custom_data.merchant_account_id,
          currency: revenueRow.custom_data.currency,
          hasGeneratedBatch,
        });
      }

      rowsToInsert.push(revenueRow);

      // Log para debug
      if (settlement_batch_id) {
        console.log(`[Transaction ${transaction.id}] Settlement Batch ID: ${settlement_batch_id}`);
      }

      // 2️⃣ FEE - Registro do fee do Braintree (Contas a Pagar)
      const fee = calculateTransactionFee(transaction);

      if (fee > 0) {
        const feeRow = {
          // ✅ ID único com currency prefix para evitar colisões
          id: `braintree-fee-${txCurrency}-${transaction.id}`,
          file_name: "braintree-api-sync.csv",
          source: "braintree-api-fees",
          date: transactionDate.toISOString().split("T")[0],
          description: `Fee Braintree - ${transaction.id}`,
          amount: -fee, // Negativo porque é uma despesa
          reconciled: false,

          custom_data: {
            transaction_id: transaction.id,
            related_revenue_amount: parseFloat(transaction.amount),
            currency: txCurrency,
            fee_type: "braintree_processing_fee",
            merchant_account_id: transaction.merchantAccountId,
          },
        };

        feeRowsToInsert.push(feeRow);
      }
    }

    // Deduplicação: Buscar transações existentes
    console.log(`\n🔍 Verificando duplicatas...`);

    const { data: existingRevenue } = await supabaseAdmin
      .from("csv_rows")
      .select("custom_data")
      .eq("source", "braintree-api-revenue");

    const { data: existingFees } = await supabaseAdmin
      .from("csv_rows")
      .select("custom_data")
      .eq("source", "braintree-api-fees");

    // Criar Sets com transaction_ids existentes
    const existingRevenueIds = new Set(
      (existingRevenue || []).map(r => r.custom_data?.transaction_id).filter(Boolean)
    );
    const existingFeeIds = new Set(
      (existingFees || []).map(r => r.custom_data?.transaction_id).filter(Boolean)
    );

    // Filtrar apenas transações novas
    const newRevenue = rowsToInsert.filter(row =>
      !existingRevenueIds.has(row.custom_data?.transaction_id)
    );
    const newFees = feeRowsToInsert.filter(row =>
      !existingFeeIds.has(row.custom_data?.transaction_id)
    );

    console.log(`📊 Revenue: ${rowsToInsert.length} total | ${rowsToInsert.length - newRevenue.length} duplicadas | ${newRevenue.length} novas`);
    console.log(`📊 Fees: ${feeRowsToInsert.length} total | ${feeRowsToInsert.length - newFees.length} duplicadas | ${newFees.length} novas`);

    // Salva no Supabase apenas as novas
    let revenueInserted = 0;
    let feesInserted = 0;
    const duplicatesSkipped = (rowsToInsert.length - newRevenue.length) + (feeRowsToInsert.length - newFees.length);

    if (newRevenue.length > 0) {
      const { error: revenueError, data: revenueData } = await supabaseAdmin
        .from("csv_rows")
        .insert(newRevenue)
        .select();

      if (revenueError) {
        console.error("[Braintree Sync] Erro ao inserir receitas:", revenueError);
        throw revenueError;
      }

      revenueInserted = revenueData?.length || 0;
    }

    if (newFees.length > 0) {
      const { error: feesError, data: feesData } = await supabaseAdmin
        .from("csv_rows")
        .insert(newFees)
        .select();

      if (feesError) {
        console.error("[Braintree Sync] Erro ao inserir fees:", feesError);
        throw feesError;
      }

      feesInserted = feesData?.length || 0;
    }

    // Estatísticas
    const totalRevenue = rowsToInsert.reduce((sum, row) => sum + row.amount, 0);
    const totalFees = Math.abs(
      feeRowsToInsert.reduce((sum, row) => sum + row.amount, 0)
    );

    // Atualizar sync_metadata
    const source = currency === 'EUR' ? 'braintree-eur' :
      currency === 'USD' ? 'braintree-usd' :
        'braintree-amex';

    await updateSyncMetadata({
      source,
      syncType: 'api',
      recordsAdded: revenueInserted,
      lastRecordDate: transactions.length > 0
        ? (() => {
          try {
            return new Date(transactions[0].createdAt);
          } catch {
            return new Date();
          }
        })()
        : new Date(),
      status: 'success',
    });

    return NextResponse.json({
      success: true,
      message: `Sincronização concluída com sucesso`,
      data: {
        period: {
          start: startDate,
          end: endDate,
        },
        transactions_processed: transactions.length,
        revenue_rows_inserted: revenueInserted,
        fee_rows_inserted: feesInserted,
        duplicates_skipped: duplicatesSkipped,
        total_revenue: totalRevenue,
        total_fees: totalFees,
        net_amount: totalRevenue - totalFees,
        currency: currency,
      },
    });
  } catch (error: any) {
    console.error("[Braintree Sync] Erro na sincronização:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao sincronizar transações do Braintree",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Buscar última sincronização e estatísticas
 */
export async function GET(req: NextRequest) {
  try {
    // Busca últimas transações sincronizadas
    const { data: lastRevenue, error: revenueError } = await supabaseAdmin
      .from("csv_rows")
      .select("date, amount, custom_data")
      .eq("source", "braintree-api-revenue")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const { data: lastFee, error: feeError } = await supabaseAdmin
      .from("csv_rows")
      .select("date, amount")
      .eq("source", "braintree-api-fees")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    // Conta totais
    const { count: revenueCount } = await supabaseAdmin
      .from("csv_rows")
      .select("*", { count: "exact", head: true })
      .eq("source", "braintree-api-revenue");

    const { count: feeCount } = await supabaseAdmin
      .from("csv_rows")
      .select("*", { count: "exact", head: true })
      .eq("source", "braintree-api-fees");

    return NextResponse.json({
      success: true,
      data: {
        last_sync: {
          revenue: lastRevenue || null,
          fee: lastFee || null,
        },
        totals: {
          revenue_transactions: revenueCount || 0,
          fee_transactions: feeCount || 0,
        },
      },
    });
  } catch (error: any) {
    console.error("[Braintree Sync] Erro ao buscar estatísticas:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erro ao buscar estatísticas de sincronização",
      },
      { status: 500 }
    );
  }
}

// ==================== NOVAS FUNÇÕES ====================

/**
 * Modo Update: Atualiza transações com upsert inteligente
 */
async function handleUpdateMode(params: {
  preserveReconciliation: boolean;
  skipIfConciliado: boolean;
  daysBack: number;
  updateType: string;
  currency: string;
}): Promise<NextResponse> {
  const { preserveReconciliation, skipIfConciliado, daysBack, updateType, currency } = params;

  console.log(`[Braintree Sync] Update mode: ${updateType}`);
  console.log(`[Braintree Sync] Options:`, {
    preserveReconciliation,
    skipIfConciliado,
    daysBack,
  });

  // Calcular datas
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);

  // Buscar transações do Braintree
  const transactions = await searchTransactions(start, end);

  console.log(`[Braintree Sync] Found ${transactions.length} transactions`);

  if (transactions.length === 0) {
    await saveLastSyncTimestamp(updateType as "automatic" | "safe" | "force");

    return NextResponse.json({
      success: true,
      message: "No transactions to sync",
      stats: {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        reconciled_preserved: 0,
      },
    });
  }

  // Converter para formato de upsert
  const transactionsData = transactions.map((tx) => {
    // 🔑 GERAR SETTLEMENT BATCH ID
    // Formato: YYYY-MM-DD_merchantAccount_uniqueId
    let settlement_batch_id: string | null = null;
    try {
      if (tx.disbursementDetails?.disbursementDate) {
        const disbDate = new Date(tx.disbursementDetails.disbursementDate);
        const dateStr = disbDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const merchantAccount = tx.merchantAccountId || 'unknown';
        const uniqueId = tx.disbursementDetails.disbursementId || tx.id;
        settlement_batch_id = `${dateStr}_${merchantAccount}_${uniqueId}`;
      }
    } catch (err) {
      console.error(`[Settlement Batch ID] Error generating for transaction ${tx.id}:`, err);
    }

    return {
      transaction_id: tx.id,
      status: tx.status,
      type: tx.type,
      amount: parseFloat(tx.amount),
      currency: tx.currencyIsoCode,
      customer_name: getCustomerName(tx),
      customer_email: tx.customer?.email,
      payment_method: getPaymentMethod(tx),
      merchant_account_id: tx.merchantAccountId,
      created_at: (() => {
        try {
          return tx.createdAt.toISOString();
        } catch (err) {
          console.error(`[Created At] Error for transaction ${tx.id}:`, err);
          return new Date().toISOString();
        }
      })(),
      settlement_amount: tx.disbursementDetails?.settlementAmount
        ? parseFloat(tx.disbursementDetails.settlementAmount)
        : null,
      disbursement_id: tx.disbursementDetails?.disbursementId || null,
      disbursement_date: (() => {
        try {
          return tx.disbursementDetails?.disbursementDate
            ? new Date(tx.disbursementDetails.disbursementDate).toISOString()
            : null;
        } catch (err) {
          console.error(`[Disbursement Date] Error for transaction ${tx.id}:`, err);
          return null;
        }
      })(),
      settlement_batch_id: settlement_batch_id, // 🆕 Settlement Batch ID
      settlement_currency_iso_code: tx.disbursementDetails?.settlementCurrencyIsoCode || null,
      settlement_currency_exchange_rate: (() => {
        try {
          return tx.disbursementDetails?.settlementCurrencyExchangeRate
            ? parseFloat(tx.disbursementDetails.settlementCurrencyExchangeRate)
            : null;
        } catch (err) {
          console.error(`[Exchange Rate] Error for transaction ${tx.id}:`, err);
          return null;
        }
      })(),
      service_fee_amount: tx.serviceFeeAmount ? parseFloat(tx.serviceFeeAmount) : 0,
      processing_fee: 0, // Calcular se necessário
      merchant_account_fee: 0,
      discount_amount: 0, // Não disponível na API
      tax_amount: 0, // Não disponível na API
    };
  });

  // Processar em lotes
  const batchSize = 50;
  const totalResults = {
    total: transactions.length,
    success: 0,
    failed: 0,
    updated: 0,
    created: 0,
    skipped: 0,
    reconciled_preserved: 0,
  };

  for (let i = 0; i < transactionsData.length; i += batchSize) {
    const batch = transactionsData.slice(i, i + batchSize);
    const batchResults = await batchUpsertTransactions(batch, "braintree-api-revenue", {
      preserveReconciliation,
      skipIfConciliado,
    });

    totalResults.success += batchResults.success;
    totalResults.failed += batchResults.failed;
    totalResults.updated += batchResults.updated;
    totalResults.created += batchResults.created;
    totalResults.skipped += batchResults.skipped;
    totalResults.reconciled_preserved += batchResults.reconciled_preserved;
  }

  // Salvar timestamp
  await saveLastSyncTimestamp(updateType as "automatic" | "safe" | "force");

  console.log("[Braintree Sync] Update completed:", totalResults);

  return NextResponse.json({
    success: true,
    message: `${updateType === "force" ? "Force" : "Safe"} update completed: ${totalResults.created} new, ${totalResults.updated} updated${totalResults.reconciled_preserved > 0 ? `, ${totalResults.reconciled_preserved} reconciliations preserved` : ""}`,
    stats: totalResults,
  });
}
