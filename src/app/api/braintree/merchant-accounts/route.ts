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
        // Lista todos os merchant accounts usando stream
        const result = await new Promise((resolve, reject) => {
            braintreeGateway.merchantAccount.all((err: any, response: any) => {
                if (err) {
                    reject(err);
                    return;
                }

                const accounts: any[] = [];

                if (response && typeof response.each === "function") {
                    response.each((err: any, account: any) => {
                        if (!err && account) {
                            accounts.push({
                                id: account.id,
                                status: account.status,
                                currencyIsoCode: account.currencyIsoCode,
                                default: account.default,
                                masterMerchantAccount: account.masterMerchantAccount?.id,
                            });
                        }
                    });
                }

                setTimeout(() => resolve(accounts), 100);
            });
        });

        return NextResponse.json({
            success: true,
            total: (result as any[]).length,
            accounts: result,
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
