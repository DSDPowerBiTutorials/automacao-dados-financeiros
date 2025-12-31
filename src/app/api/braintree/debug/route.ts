/**
 * API Route: Debug Braintree - Ver todas as transações brutas
 * 
 * Endpoint para diagnosticar por que a sincronização não encontra transações.
 * Mostra dados brutos retornados pela API do Braintree.
 */

import { NextRequest, NextResponse } from "next/server";
import { braintreeGateway } from "@/lib/braintree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate e endDate são obrigatórios" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(`[Debug] Buscando transações de ${startDate} até ${endDate}`);

    // Busca SEM filtros (todas as transações)
    const result = await new Promise((resolve, reject) => {
      braintreeGateway.transaction.search(
        (search) => {
          search.createdAt().between(start, end);
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }

          const transactions: any[] = [];
          const debug = {
            success: response?.success,
            hasEach: typeof response?.each === "function",
            responseType: typeof response,
          };

          if (response && response.each) {
            response.each((err, transaction) => {
              if (!err && transaction) {
                transactions.push({
                  id: transaction.id,
                  amount: transaction.amount,
                  status: transaction.status,
                  type: transaction.type,
                  createdAt: transaction.createdAt,
                  merchantAccountId: transaction.merchantAccountId,
                  currencyIsoCode: transaction.currencyIsoCode,
                  customer: {
                    id: transaction.customer?.id,
                    email: transaction.customer?.email,
                  },
                });
              }
            });
          }

          setTimeout(() => {
            resolve({
              debug,
              total_found: transactions.length,
              transactions: transactions.slice(0, 10), // Primeiras 10
            });
          }, 200);
        }
      );
    });

    return NextResponse.json({
      success: true,
      period: { start: startDate, end: endDate },
      credentials: {
        merchantId: process.env.BRAINTREE_MERCHANT_ID,
        environment: process.env.BRAINTREE_ENVIRONMENT,
      },
      data: result,
    });
  } catch (error: any) {
    console.error("[Debug] Erro:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao buscar transações",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}
