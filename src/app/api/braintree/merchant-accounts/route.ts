/**
 * API Route: Listar Merchant Accounts do Braintree
 * 
 * Endpoint para descobrir todos os merchant accounts disponíveis
 * (importante quando há contas separadas por moeda)
 */

import { NextResponse } from "next/server";
import { braintreeGateway } from "@/lib/braintree";

export async function GET() {
  try {
    // Lista todos os merchant accounts
    const merchantAccounts = await braintreeGateway.merchantAccount.all();

    const accounts = merchantAccounts.map((account: any) => ({
      id: account.id,
      status: account.status,
      currencyIsoCode: account.currencyIsoCode,
      default: account.default,
      masterMerchantAccount: account.masterMerchantAccount?.id,
    }));

    return NextResponse.json({
      success: true,
      total: accounts.length,
      accounts,
    });
  } catch (error: any) {
    console.error("[Merchant Accounts] Erro:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao listar merchant accounts",
      },
      { status: 500 }
    );
  }
}
