/**
 * Stripe API Integration
 * Handles synchronization with Stripe API to fetch charges, payments, and payouts
 * 
 * 🔑 Campos importantes para reconciliação:
 * - metadata.order_id: Order ID do sistema de e-commerce
 * - customer email: Para match alternativo
 * - customer name: Para match por nome
 */

import { supabase } from "./supabase";

const STRIPE_API_URL = "https://api.stripe.com/v1";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// Tipos
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
        address?: {
            city?: string;
            country?: string;
            line1?: string;
            postal_code?: string;
        };
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

export interface StripeTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    type: "charge" | "payout" | "refund";
    order_id?: string;
    customer_email?: string;
    customer_name?: string;
    payment_method?: string;
}

/**
 * Valida se a chave do Stripe está configurada
 */
function validateStripeKey(): void {
    if (!STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not configured. Add it to your .env.local file.");
    }
}

/**
 * Faz uma requisição autenticada para a API do Stripe
 */
async function stripeRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    validateStripeKey();

    const url = new URL(`${STRIPE_API_URL}${endpoint}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
    }

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
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
 * Busca charges (cobranças) do Stripe desde uma data específica
 */
export async function fetchStripeCharges(sinceDate?: Date): Promise<StripeCharge[]> {
    const params: Record<string, string> = {
        limit: "100",
    };

    if (sinceDate) {
        params["created[gte]"] = Math.floor(sinceDate.getTime() / 1000).toString();
    }

    const response = await stripeRequest<{ data: StripeCharge[] }>("/charges", params);
    return response.data || [];
}

/**
 * Busca payouts (transferências bancárias) do Stripe
 */
export async function fetchStripePayouts(sinceDate?: Date): Promise<StripePayout[]> {
    const params: Record<string, string> = {
        limit: "100",
    };

    if (sinceDate) {
        params["created[gte]"] = Math.floor(sinceDate.getTime() / 1000).toString();
    }

    const response = await stripeRequest<{ data: StripePayout[] }>("/payouts", params);
    return response.data || [];
}

/**
 * Converte timestamp Unix para data ISO
 */
function unixToDate(timestamp: number): string {
    return new Date(timestamp * 1000).toISOString().split("T")[0];
}

/**
 * Extrai Order ID do metadata ou description
 */
function extractOrderId(charge: StripeCharge): string | null {
    // 1. Verifica metadata
    if (charge.metadata?.order_id) return charge.metadata.order_id;
    if (charge.metadata?.orderId) return charge.metadata.orderId;

    // 2. Tenta extrair do description (formato: "Order #abc1234")
    if (charge.description) {
        const match = charge.description.match(/order[:\s#]*([a-f0-9]{7})/i);
        if (match) return match[1];
    }

    return null;
}

/**
 * Sincroniza transações do Stripe com o Supabase
 */
export async function syncStripeTransactions(options?: {
    sinceDate?: Date;
    currency?: "EUR" | "USD";
}): Promise<{
    success: boolean;
    chargesCount: number;
    payoutsCount: number;
    error?: string;
}> {
    try {
        validateStripeKey();

        const sinceDate = options?.sinceDate || new Date("2024-01-01");
        const currency = options?.currency?.toLowerCase() || "eur";

        console.log(`[Stripe Sync] Buscando transações desde ${sinceDate.toISOString()}`);

        // Buscar charges e payouts
        const [charges, payouts] = await Promise.all([
            fetchStripeCharges(sinceDate),
            fetchStripePayouts(sinceDate),
        ]);

        console.log(`[Stripe Sync] Encontrados: ${charges.length} charges, ${payouts.length} payouts`);

        // Filtrar por moeda se especificado
        const filteredCharges = charges.filter(
            c => c.currency.toLowerCase() === currency && c.status === "succeeded"
        );

        if (!supabase) {
            throw new Error("Supabase client não configurado");
        }

        // Preparar rows para inserção
        const rows = filteredCharges.map(charge => {
            const orderId = extractOrderId(charge);
            const customerEmail = charge.receipt_email || charge.billing_details?.email || null;
            const customerName = charge.billing_details?.name || null;
            const paymentMethod = charge.payment_method_details?.card
                ? `${charge.payment_method_details.card.brand} ****${charge.payment_method_details.card.last4}`
                : charge.payment_method_details?.type || "unknown";

            return {
                id: `stripe-${currency}-${charge.id}`,
                file_name: "stripe-api-sync.csv",
                source: `stripe-${currency}` as const,
                date: unixToDate(charge.created),
                description: `${customerName || "Stripe Customer"} - ${paymentMethod}`,
                amount: charge.amount / 100, // Stripe usa centavos
                reconciled: false,
                customer_email: customerEmail,
                customer_name: customerName,
                custom_data: {
                    transaction_id: charge.id,
                    order_id: orderId,
                    status: charge.status,
                    currency: charge.currency.toUpperCase(),
                    customer_email: customerEmail,
                    customer_name: customerName,
                    payment_method: paymentMethod,
                    payment_intent: charge.payment_intent,
                    created_at: new Date(charge.created * 1000).toISOString(),
                    // Metadados originais (podem conter order_id)
                    metadata: charge.metadata,
                },
            };
        });

        // Inserir no Supabase
        if (rows.length > 0) {
            const { error } = await supabase
                .from("csv_rows")
                .upsert(rows, { onConflict: "id" });

            if (error) {
                throw new Error(`Erro ao inserir no Supabase: ${error.message}`);
            }
        }

        console.log(`[Stripe Sync] ✅ ${rows.length} transações sincronizadas`);

        return {
            success: true,
            chargesCount: filteredCharges.length,
            payoutsCount: payouts.length,
        };
    } catch (error) {
        console.error("[Stripe Sync] ❌ Erro:", error);
        return {
            success: false,
            chargesCount: 0,
            payoutsCount: 0,
            error: error instanceof Error ? error.message : "Erro desconhecido",
        };
    }
}

/**
 * Testa a conexão com a API do Stripe
 */
export async function testStripeConnection(): Promise<{
    success: boolean;
    message: string;
    accountName?: string;
}> {
    try {
        validateStripeKey();

        const response = await stripeRequest<{ id: string; business_profile?: { name?: string } }>("/account");

        return {
            success: true,
            message: "Connection successful",
            accountName: response.business_profile?.name || response.id,
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
