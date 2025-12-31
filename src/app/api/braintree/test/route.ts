/**
 * API Route: Teste de conexão do Braintree
 * 
 * Verifica se as credenciais estão corretas tentando buscar
 * informações básicas do merchant account.
 */

import { NextRequest, NextResponse } from "next/server";
import { braintreeGateway } from "@/lib/braintree";

export async function GET(req: NextRequest) {
  try {
    // Tenta buscar uma transação qualquer só para testar autenticação
    const result = await new Promise((resolve, reject) => {
      braintreeGateway.transaction.search(
        (search) => {
          // Busca últimos 7 dias
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          
          search.createdAt().between(startDate, endDate);
        },
        (err, response) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Conta quantas transações existem
          let count = 0;
          const transactions: any[] = [];
          
          if (response && response.each) {
            response.each((err, transaction) => {
              if (!err && transaction) {
                count++;
                if (count <= 5) {
                  transactions.push({
                    id: transaction.id,
                    amount: transaction.amount,
                    status: transaction.status,
                    createdAt: transaction.createdAt,
                  });
                }
              }
            });
          }
          
          setTimeout(() => {
            resolve({
              authenticated: true,
              totalFound: count,
              sample: transactions,
            });
          }, 200);
        }
      );
    });

    return NextResponse.json({
      success: true,
      message: "Conexão com Braintree estabelecida com sucesso!",
      data: result,
      credentials: {
        merchantId: process.env.BRAINTREE_MERCHANT_ID,
        environment: process.env.BRAINTREE_ENVIRONMENT,
      },
    });
  } catch (error: any) {
    console.error("[Braintree Test] Erro:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao conectar com Braintree",
        errorType: error.name,
        details: error.toString(),
        credentials: {
          merchantId: process.env.BRAINTREE_MERCHANT_ID,
          environment: process.env.BRAINTREE_ENVIRONMENT,
          publicKey: process.env.BRAINTREE_PUBLIC_KEY?.substring(0, 8) + "...",
        },
      },
      { status: 500 }
    );
  }
}
