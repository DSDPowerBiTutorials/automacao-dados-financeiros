/**
 * Stripe Multi-Account Management
 * 
 * Gerencia múltiplas contas Stripe como uma fonte unificada:
 * - DSD OnDemand (EUR) → Bankinter-4605
 * - Digitalsmiledesign (EUR) → Bankinter-4605
 * - Dsdplanningcenter (USD) → Chase-USD-9186
 */

import { supabaseAdmin } from "./supabase-admin";

const STRIPE_API_URL = "https://api.stripe.com/v1";

export interface StripeAccountConfig {
    id: string;
    name: string;
    secretKey: string;
    webhookSecret: string;
    currency: string;
    bankAccount: string; // conta bancária associada para reconciliação
}

export interface StripeCharge {
    id: string;
    amount: number;
    amount_refunded: number;
    currency: string;
    status: string;
    created: number;
    description?: string;
    customer?: string;
    receipt_email?: string;
    billing_details?: {
        name?: string;
        email?: string;
        phone?: string;
    };
    metadata?: {
        order_id?: string;
        orderId?: string;
        [key: string]: string | undefined;
    };
    payment_intent?: string;
    payment_method_details?: {
        type: string;
        card?: {
            brand?: string;
            last4?: string;
        };
    };
}

export interface StripePayout {
    id: string;
    amount: number;
    arrival_date: number;
    created: number;
    currency: string;
    description?: string;
    status: string;
    type: string;
}

export interface StripeBalanceTransaction {
    id: string;
    amount: number;
    available_on: number;
    created: number;
    currency: string;
    description?: string;
    fee: number;
    net: number;
    reporting_category: string;
    source?: string;
    status: string;
    type: string;
}

/**
 * Retorna a configuração das 3 contas Stripe
 */
export function getStripeAccounts(): StripeAccountConfig[] {
    return [
        {
            id: "stripe-account-1",
            name: process.env.STRIPE_ACCOUNT_NAME_1 || "DSD OnDemand",
            secretKey: process.env.STRIPE_SECRET_KEY || "",
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
            currency: process.env.STRIPE_CURRENCY_1 || "EUR",
            bankAccount: process.env.STRIPE_BANK_ACCOUNT_1 || "bankinter-4605",
        },
        {
            id: "stripe-account-2",
            name: process.env.STRIPE_ACCOUNT_NAME_2 || "Digitalsmiledesign",
            secretKey: process.env.STRIPE_SECRET_KEY_2 || "",
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET_2 || "",
            currency: process.env.STRIPE_CURRENCY_2 || "EUR",
            bankAccount: process.env.STRIPE_BANK_ACCOUNT_2 || "bankinter-4605",
        },
        {
            id: "stripe-account-3",
            name: process.env.STRIPE_ACCOUNT_NAME_3 || "Dsdplanningcenter",
            secretKey: process.env.STRIPE_SECRET_KEY_3 || "",
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET_3 || "",
            currency: process.env.STRIPE_CURRENCY_3 || "USD",
            bankAccount: process.env.STRIPE_BANK_ACCOUNT_3 || "chase-usd-9186",
        },
    ];
}

/**
 * Faz requisição autenticada para uma conta Stripe específica
 */
async function stripeRequest<T>(
    secretKey: string,
    endpoint: string,
    params?: Record<string, string>
): Promise<T> {
    if (!secretKey) {
        throw new Error("Stripe secret key not configured");
    }

    const url = new URL(`${STRIPE_API_URL}${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Stripe API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    return response.json();
}

/**
 * Busca balance transactions de uma conta específica
 * Implementa paginação automática com cursor para buscar TODOS os resultados
 */
export async function fetchBalanceTransactions(
    secretKey: string,
    sinceDate?: Date,
    limit: number = 100
): Promise<StripeBalanceTransaction[]> {
    const allTransactions: StripeBalanceTransaction[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
        const params: Record<string, string> = {
            limit: limit.toString(),
        };

        if (sinceDate) {
            params["created[gte]"] = Math.floor(sinceDate.getTime() / 1000).toString();
        }

        if (startingAfter) {
            params["starting_after"] = startingAfter;
        }

        const response = await stripeRequest<{ data: StripeBalanceTransaction[]; has_more: boolean }>(
            secretKey,
            "/balance_transactions",
            params
        );
        const transactions = response.data || [];
        allTransactions.push(...transactions);

        hasMore = response.has_more && transactions.length > 0;
        if (transactions.length > 0) {
            startingAfter = transactions[transactions.length - 1].id;
        }
    }

    console.log(`[Stripe Multi] Fetched ${allTransactions.length} balance transactions (paginated)`);
    return allTransactions;
}

/**
 * Busca charges de uma conta específica
 * Implementa paginação automática com cursor para buscar TODOS os resultados
 */
export async function fetchCharges(
    secretKey: string,
    sinceDate?: Date,
    limit: number = 100
): Promise<StripeCharge[]> {
    const allCharges: StripeCharge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
        const params: Record<string, string> = {
            limit: limit.toString(),
        };

        if (sinceDate) {
            params["created[gte]"] = Math.floor(sinceDate.getTime() / 1000).toString();
        }

        if (startingAfter) {
            params["starting_after"] = startingAfter;
        }

        const response = await stripeRequest<{ data: StripeCharge[]; has_more: boolean }>(
            secretKey,
            "/charges",
            params
        );
        const charges = response.data || [];
        allCharges.push(...charges);

        hasMore = response.has_more && charges.length > 0;
        if (charges.length > 0) {
            startingAfter = charges[charges.length - 1].id;
        }
    }

    console.log(`[Stripe Multi] Fetched ${allCharges.length} charges (paginated)`);
    return allCharges;
}

/**
 * Busca payouts de uma conta específica
 * Implementa paginação automática com cursor para buscar TODOS os resultados
 */
export async function fetchPayouts(
    secretKey: string,
    sinceDate?: Date,
    limit: number = 100
): Promise<StripePayout[]> {
    const allPayouts: StripePayout[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
        const params: Record<string, string> = {
            limit: limit.toString(),
        };

        if (sinceDate) {
            params["created[gte]"] = Math.floor(sinceDate.getTime() / 1000).toString();
        }

        if (startingAfter) {
            params["starting_after"] = startingAfter;
        }

        const response = await stripeRequest<{ data: StripePayout[]; has_more: boolean }>(
            secretKey,
            "/payouts",
            params
        );
        const payouts = response.data || [];
        allPayouts.push(...payouts);

        hasMore = response.has_more && payouts.length > 0;
        if (payouts.length > 0) {
            startingAfter = payouts[payouts.length - 1].id;
        }
    }

    console.log(`[Stripe Multi] Fetched ${allPayouts.length} payouts (paginated)`);
    return allPayouts;
}

/**
 * Converte timestamp Unix para data ISO
 */
function unixToDate(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/**
 * Testa conexão de uma conta Stripe
 */
export async function testStripeAccount(
    secretKey: string
): Promise<{ success: boolean; accountName?: string; error?: string }> {
    try {
        const response = await stripeRequest<{
            id: string;
            business_profile?: { name?: string };
            settings?: { dashboard?: { display_name?: string } };
        }>(secretKey, "/account");

        return {
            success: true,
            accountName:
                response.business_profile?.name ||
                response.settings?.dashboard?.display_name ||
                response.id,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Testa conexão de todas as contas Stripe
 */
export async function testAllStripeConnections(): Promise<{
    accounts: Array<{
        id: string;
        name: string;
        currency: string;
        bankAccount: string;
        connected: boolean;
        accountName?: string;
        error?: string;
    }>;
}> {
    const accounts = getStripeAccounts();
    const results = await Promise.all(
        accounts.map(async (account) => {
            if (!account.secretKey) {
                return {
                    id: account.id,
                    name: account.name,
                    currency: account.currency,
                    bankAccount: account.bankAccount,
                    connected: false,
                    error: "Secret key not configured",
                };
            }

            const result = await testStripeAccount(account.secretKey);
            return {
                id: account.id,
                name: account.name,
                currency: account.currency,
                bankAccount: account.bankAccount,
                connected: result.success,
                accountName: result.accountName,
                error: result.error,
            };
        })
    );

    return { accounts: results };
}

/**
 * Sincroniza charges de uma conta Stripe específica
 */
export async function syncStripeAccountCharges(
    account: StripeAccountConfig,
    sinceDate?: Date
): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        if (!account.secretKey) {
            throw new Error(`Secret key not configured for ${account.name}`);
        }

        const charges = await fetchCharges(account.secretKey, sinceDate);
        const successfulCharges = charges.filter((c) => c.status === "succeeded");

        if (successfulCharges.length === 0) {
            return { success: true, count: 0 };
        }

        const rows = successfulCharges.map((charge) => {
            const customerEmail = charge.receipt_email || charge.billing_details?.email || null;
            const customerName = charge.billing_details?.name || null;
            const paymentMethod = charge.payment_method_details?.card
                ? `${charge.payment_method_details.card.brand} ****${charge.payment_method_details.card.last4}`
                : charge.payment_method_details?.type || "unknown";

            // Data estimada de disbursement (+2 dias úteis)
            const createdDate = new Date(charge.created * 1000);
            const disbursementDate = new Date(createdDate);
            disbursementDate.setDate(disbursementDate.getDate() + 2);

            return {
                id: `stripe-${account.currency.toLowerCase()}-${charge.id}`,
                file_name: `stripe-${account.name.toLowerCase().replace(/\s+/g, "-")}-sync`,
                source: `stripe-${account.currency.toLowerCase()}`,
                date: unixToDate(charge.created),
                description: `${customerName || "Stripe Customer"} - ${paymentMethod}`,
                amount: (charge.amount / 100).toString(),
                reconciled: false,
                customer_email: customerEmail,
                customer_name: customerName,
                custom_data: {
                    transaction_id: charge.id,
                    order_id: charge.metadata?.order_id || charge.metadata?.orderId || null,
                    status: charge.status,
                    type: "sale",
                    currency: charge.currency.toUpperCase(),
                    customer_email: customerEmail,
                    customer_name: customerName,
                    payment_method: paymentMethod,
                    payment_intent: charge.payment_intent,
                    created_at: new Date(charge.created * 1000).toISOString(),
                    settlement_date: unixToDate(charge.created),
                    disbursement_date: disbursementDate.toISOString().split("T")[0],
                    stripe_account_id: account.id,
                    stripe_account_name: account.name,
                    bank_account: account.bankAccount,
                    metadata: charge.metadata,
                },
            };
        });

        if (!supabaseAdmin) {
            throw new Error("Supabase client not configured");
        }

        const { error } = await supabaseAdmin.from("csv_rows").upsert(rows, { onConflict: "id" });

        if (error) {
            throw new Error(`Supabase error: ${error.message}`);
        }

        console.log(`[Stripe ${account.name}] ✅ ${rows.length} charges synced`);
        return { success: true, count: rows.length };
    } catch (error) {
        console.error(`[Stripe ${account.name}] ❌ Error:`, error);
        return {
            success: false,
            count: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Sincroniza payouts de uma conta Stripe específica
 */
export async function syncStripeAccountPayouts(
    account: StripeAccountConfig,
    sinceDate?: Date
): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        if (!account.secretKey) {
            throw new Error(`Secret key not configured for ${account.name}`);
        }

        const payouts = await fetchPayouts(account.secretKey, sinceDate);
        const paidPayouts = payouts.filter((p) => p.status === "paid");

        if (paidPayouts.length === 0) {
            return { success: true, count: 0 };
        }

        const rows = paidPayouts.map((payout) => ({
            id: `stripe-payout-${account.currency.toLowerCase()}-${payout.id}`,
            file_name: `stripe-${account.name.toLowerCase().replace(/\s+/g, "-")}-payouts`,
            source: `stripe-${account.currency.toLowerCase()}-payouts`,
            date: unixToDate(payout.arrival_date),
            description: `Stripe Payout - ${account.name}`,
            amount: (payout.amount / 100).toString(),
            reconciled: false,
            custom_data: {
                transaction_id: payout.id,
                type: "payout",
                currency: payout.currency.toUpperCase(),
                status: payout.status,
                created_at: new Date(payout.created * 1000).toISOString(),
                arrival_date: unixToDate(payout.arrival_date),
                stripe_account_id: account.id,
                stripe_account_name: account.name,
                bank_account: account.bankAccount,
            },
        }));

        if (!supabaseAdmin) {
            throw new Error("Supabase client not configured");
        }

        const { error } = await supabaseAdmin.from("csv_rows").upsert(rows, { onConflict: "id" });

        if (error) {
            throw new Error(`Supabase error: ${error.message}`);
        }

        console.log(`[Stripe ${account.name}] ✅ ${rows.length} payouts synced`);
        return { success: true, count: rows.length };
    } catch (error) {
        console.error(`[Stripe ${account.name}] ❌ Payout error:`, error);
        return {
            success: false,
            count: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Sincroniza todas as contas Stripe
 */
export async function syncAllStripeAccounts(sinceDate?: Date): Promise<{
    success: boolean;
    accounts: Array<{
        name: string;
        currency: string;
        bankAccount: string;
        chargesCount: number;
        payoutsCount: number;
        error?: string;
    }>;
    totalCharges: number;
    totalPayouts: number;
}> {
    const accounts = getStripeAccounts();
    const results = [];
    let totalCharges = 0;
    let totalPayouts = 0;

    for (const account of accounts) {
        if (!account.secretKey) {
            results.push({
                name: account.name,
                currency: account.currency,
                bankAccount: account.bankAccount,
                chargesCount: 0,
                payoutsCount: 0,
                error: "Secret key not configured",
            });
            continue;
        }

        const [chargesResult, payoutsResult] = await Promise.all([
            syncStripeAccountCharges(account, sinceDate),
            syncStripeAccountPayouts(account, sinceDate),
        ]);

        results.push({
            name: account.name,
            currency: account.currency,
            bankAccount: account.bankAccount,
            chargesCount: chargesResult.count,
            payoutsCount: payoutsResult.count,
            error: chargesResult.error || payoutsResult.error,
        });

        totalCharges += chargesResult.count;
        totalPayouts += payoutsResult.count;
    }

    return {
        success: results.every((r) => !r.error),
        accounts: results,
        totalCharges,
        totalPayouts,
    };
}
