/**
 * API Route: Sincronização de transações do Braintree
 * 
 * Busca transações do Braintree e salva no formato compatível com csv_rows.
 * 
 * Fluxo:
 * 1. Busca transações settled/settled_successfully em intervalo de datas
 * 2. Cria registros em csv_rows:
 *    - Transação principal → source: "braintree-api-revenue" (Contas a Receber)
 *    - Fee da transação → source: "braintree-api-fees" (Contas a Pagar)
 * 3. Retorna estatísticas da sincronização
 * 
 * Uso:
 * POST /api/braintree/sync
 * Body: { startDate: "2024-01-01", endDate: "2024-01-31", currency: "EUR" }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  searchTransactions,
  calculateTransactionFee,
  getCustomerName,
  getPaymentMethod,
  type BraintreeTransactionData,
} from "@/lib/braintree";
import braintree from "braintree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate, currency = "EUR" } = body;

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
      // 1️⃣ RECEITA - Registro principal da transação (Contas a Receber)
      const transactionDate = new Date(transaction.createdAt);
      const revenueRow = {
        id: `braintree-rev-${transaction.id}`,
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
          currency: currency,
          customer_id: transaction.customer?.id,
          customer_name: getCustomerName(transaction),
          customer_email: transaction.customer?.email,
          payment_method: getPaymentMethod(transaction),
          merchant_account_id: transaction.merchantAccountId,
          created_at: transactionDate.toISOString(),
          updated_at: new Date(transaction.updatedAt).toISOString(),
        },
      };

      rowsToInsert.push(revenueRow);

      // 2️⃣ FEE - Registro do fee do Braintree (Contas a Pagar)
      const fee = calculateTransactionFee(transaction);

      if (fee > 0) {
        const feeRow = {
          id: `braintree-fee-${transaction.id}`,
          file_name: "braintree-api-sync.csv",
          source: "braintree-api-fees",
          date: transactionDate.toISOString().split("T")[0],
          description: `Fee Braintree - ${transaction.id}`,
          amount: -fee, // Negativo porque é uma despesa
          reconciled: false,

          custom_data: {
            transaction_id: transaction.id,
            related_revenue_amount: parseFloat(transaction.amount),
            currency: currency,
            fee_type: "braintree_processing_fee",
            merchant_account_id: transaction.merchantAccountId,
          },
        };

        feeRowsToInsert.push(feeRow);
      }
    }

    // Salva no Supabase
    let revenueInserted = 0;
    let feesInserted = 0;

    if (rowsToInsert.length > 0) {
      const { error: revenueError, data: revenueData } = await supabaseAdmin
        .from("csv_rows")
        .insert(rowsToInsert)
        .select();

      if (revenueError) {
        console.error("[Braintree Sync] Erro ao inserir receitas:", revenueError);
        throw revenueError;
      }

      revenueInserted = revenueData?.length || 0;
    }

    if (feeRowsToInsert.length > 0) {
      const { error: feesError, data: feesData } = await supabaseAdmin
        .from("csv_rows")
        .insert(feeRowsToInsert)
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
