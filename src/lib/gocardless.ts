/**
 * GoCardless API Integration
 * Handles synchronization with GoCardless API to fetch payments and payouts
 * Enriches payments with customer data via mandate/customer lookups
 */

import { supabaseAdmin } from "./supabase-admin";

const GOCARDLESS_API_URL = "https://api.gocardless.com";
const GOCARDLESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;

interface GoCardlessPayment {
    id: string;
    amount: number;
    created_at: string;
    reference?: string;
    description?: string;
    status: string;
    charge_date?: string;
    payout_id?: string;
    links?: {
        mandate?: string;
        subscription?: string;
        customer?: string;
    };
}

interface GoCardlessCustomer {
    id: string;
    email?: string;
    given_name?: string;
    family_name?: string;
    company_name?: string;
    metadata?: Record<string, string>;
}

interface GoCardlessMandate {
    id: string;
    links?: {
        customer?: string;
        customer_bank_account?: string;
    };
}

interface GoCardlessSubscription {
    id: string;
    name?: string;
    amount?: number;
    currency?: string;
    status?: string;
}

interface GoCardlessPayout {
    id: string;
    amount: number;
    arrival_date: string;
    created_at: string;
    status: string;
    currency: string;
    reference?: string;
}

interface GoCardlessTransaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    status: string;
    type: "payment" | "payout" | "refund";
    payoutId?: string;
}

/**
 * Fetches all payouts from GoCardless with automatic cursor-based pagination
 * @param sinceDate - ISO date string (e.g. "2025-01-01"). Defaults to "2024-01-01"
 */
export async function fetchGoCardlessPayouts(sinceDate?: string): Promise<GoCardlessPayout[]> {
    if (!GOCARDLESS_TOKEN) {
        throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured");
    }

    const since = sinceDate || "2024-01-01";
    const allPayouts: GoCardlessPayout[] = [];
    let afterCursor: string | undefined;

    try {
        while (true) {
            let url = `${GOCARDLESS_API_URL}/payouts?created_at[gte]=${since}T00:00:00Z&limit=500`;
            if (afterCursor) {
                url += `&after=${afterCursor}`;
            }

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${GOCARDLESS_TOKEN}`,
                    "GoCardless-Version": "2015-07-06",
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `GoCardless API error: ${response.status} ${response.statusText} - ${errorBody}`,
                );
            }

            const data = await response.json();
            const payouts = data.payouts || [];
            allPayouts.push(...payouts);

            // Check for more pages using cursors
            const cursors = data.meta?.cursors;
            if (cursors?.after) {
                afterCursor = cursors.after;
            } else {
                break;
            }
        }

        console.log(`[GoCardless] Fetched ${allPayouts.length} payouts (paginated, since ${since})`);
        return allPayouts;
    } catch (error) {
        console.error("Error fetching GoCardless payouts:", error);
        throw error;
    }
}

/**
 * Fetches all payments from GoCardless with automatic cursor-based pagination
 * @param sinceDate - ISO date string (e.g. "2025-01-01"). Defaults to "2024-01-01"
 */
export async function fetchGoCardlessPayments(sinceDate?: string): Promise<GoCardlessPayment[]> {
    if (!GOCARDLESS_TOKEN) {
        throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured");
    }

    const since = sinceDate || "2024-01-01";
    const allPayments: GoCardlessPayment[] = [];
    let afterCursor: string | undefined;

    try {
        while (true) {
            let url = `${GOCARDLESS_API_URL}/payments?created_at[gte]=${since}T00:00:00Z&limit=500`;
            if (afterCursor) {
                url += `&after=${afterCursor}`;
            }

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${GOCARDLESS_TOKEN}`,
                    "GoCardless-Version": "2015-07-06",
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(
                    `GoCardless API error: ${response.status} ${response.statusText} - ${errorBody}`,
                );
            }

            const data = await response.json();
            const payments = data.payments || [];
            allPayments.push(...payments);

            // Check for more pages using cursors
            const cursors = data.meta?.cursors;
            if (cursors?.after) {
                afterCursor = cursors.after;
            } else {
                break;
            }
        }

        console.log(`[GoCardless] Fetched ${allPayments.length} payments (paginated, since ${since})`);
        return allPayments;
    } catch (error) {
        console.error("Error fetching GoCardless payments:", error);
        throw error;
    }
}

/**
 * Fetches a GoCardless resource by ID with caching
 */
async function gcApiFetch<T>(endpoint: string, cache: Map<string, T>): Promise<T | null> {
    if (cache.has(endpoint)) return cache.get(endpoint)!;
    try {
        const response = await fetch(`${GOCARDLESS_API_URL}${endpoint}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${GOCARDLESS_TOKEN}`,
                "GoCardless-Version": "2015-07-06",
                "Content-Type": "application/json",
            },
        });
        if (!response.ok) return null;
        const data = await response.json();
        // GC API wraps single resources in their type key
        const key = Object.keys(data).find(k => k !== "meta") || "";
        const result = (data[key] || data) as T;
        cache.set(endpoint, result);
        return result;
    } catch {
        return null;
    }
}

/**
 * Enriches GoCardless payments with customer data via mandate → customer lookups
 * Uses internal caching to avoid duplicate API calls for shared mandates/customers
 */
async function enrichPaymentsWithCustomerData(
    payments: GoCardlessPayment[],
): Promise<Map<string, { customer_name: string | null; customer_email: string | null; company_name: string | null; subscription_name: string | null; mandate_id: string | null; gc_subscription_id: string | null; gc_customer_id: string | null }>> {
    const customerCache = new Map<string, GoCardlessCustomer>();
    const mandateCache = new Map<string, GoCardlessMandate>();
    const subscriptionCache = new Map<string, GoCardlessSubscription>();
    const enrichmentMap = new Map<string, { customer_name: string | null; customer_email: string | null; company_name: string | null; subscription_name: string | null; mandate_id: string | null; gc_subscription_id: string | null; gc_customer_id: string | null }>();

    console.log(`[GoCardless] Enriching ${payments.length} payments with customer data...`);

    // Process in batches of 10 to respect rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < payments.length; i += BATCH_SIZE) {
        const batch = payments.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (payment) => {
            const mandateId = payment.links?.mandate || null;
            const subscriptionId = payment.links?.subscription || null;
            let customerId = payment.links?.customer || null;
            let customerName: string | null = null;
            let customerEmail: string | null = null;
            let companyName: string | null = null;
            let subscriptionName: string | null = null;

            // 1. Get customer ID from mandate if not directly available
            if (!customerId && mandateId) {
                const mandate = await gcApiFetch<GoCardlessMandate>(`/mandates/${mandateId}`, mandateCache);
                if (mandate?.links?.customer) {
                    customerId = mandate.links.customer;
                }
            }

            // 2. Fetch customer details
            if (customerId) {
                const customer = await gcApiFetch<GoCardlessCustomer>(`/customers/${customerId}`, customerCache);
                if (customer) {
                    const parts = [customer.given_name, customer.family_name].filter(Boolean);
                    customerName = parts.length > 0 ? parts.join(" ") : null;
                    customerEmail = customer.email || null;
                    companyName = customer.company_name || null;
                }
            }

            // 3. Fetch subscription details (product/plan name)
            if (subscriptionId) {
                const subscription = await gcApiFetch<GoCardlessSubscription>(`/subscriptions/${subscriptionId}`, subscriptionCache);
                if (subscription) {
                    subscriptionName = subscription.name || null;
                }
            }

            enrichmentMap.set(payment.id, {
                customer_name: customerName,
                customer_email: customerEmail,
                company_name: companyName,
                subscription_name: subscriptionName,
                mandate_id: mandateId,
                gc_subscription_id: subscriptionId,
                gc_customer_id: customerId,
            });
        }));

        if (i + BATCH_SIZE < payments.length) {
            // Small delay to respect rate limits
            await new Promise(r => setTimeout(r, 200));
        }
    }

    const enriched = [...enrichmentMap.values()].filter(e => e.customer_name || e.customer_email).length;
    console.log(`[GoCardless] Enriched ${enriched}/${payments.length} payments with customer data`);
    console.log(`[GoCardless]   Cached: ${customerCache.size} customers, ${mandateCache.size} mandates, ${subscriptionCache.size} subscriptions`);

    return enrichmentMap;
}

/**
 * Syncs GoCardless transactions to Supabase
 * @param sinceDate - ISO date string (e.g. "2025-01-01"). Defaults to "2024-01-01"
 */
export async function syncGoCardlessTransactions(sinceDate?: string): Promise<{
    success: boolean;
    payoutsCount: number;
    paymentsCount: number;
    error?: string;
}> {
    try {
        if (!GOCARDLESS_TOKEN) {
            return {
                success: false,
                payoutsCount: 0,
                paymentsCount: 0,
                error: "GOCARDLESS_ACCESS_TOKEN is not configured",
            };
        }

        // Fetch payouts and payments
        const [payouts, payments] = await Promise.all([
            fetchGoCardlessPayouts(sinceDate),
            fetchGoCardlessPayments(sinceDate),
        ]);

        // Enrich payments with customer data (mandate → customer lookups)
        const enrichmentMap = await enrichPaymentsWithCustomerData(payments);

        // Convert to unified transaction format
        const transactions: GoCardlessTransaction[] = [];

        // Add payouts
        payouts.forEach((payout) => {
            transactions.push({
                id: payout.id,
                date: payout.arrival_date || payout.created_at,
                description: payout.reference || `GoCardless Payout - ${payout.id}`,
                amount: payout.amount / 100, // Convert from cents
                currency: payout.currency,
                status: payout.status,
                type: "payout",
                payoutId: payout.id,
            });
        });

        // Add payments
        payments.forEach((payment) => {
            transactions.push({
                id: payment.id,
                date: payment.charge_date || payment.created_at,
                description:
                    payment.reference ||
                    payment.description ||
                    `GoCardless Payment - ${payment.id}`,
                amount: payment.amount / 100, // Convert from cents
                currency: "GBP", // GoCardless primarily uses GBP
                status: payment.status,
                type: "payment",
            });
        });

        // ─── Upsert to Supabase csv_rows ───
        if (supabaseAdmin) {
            const BATCH_SIZE = 500;

            // Payout rows
            const payoutRows = payouts.map((payout) => ({
                id: `gocardless-payout-${payout.id}`,
                file_name: "gocardless-api-sync",
                source: "gocardless",
                date: payout.arrival_date || payout.created_at?.split("T")[0],
                description: payout.reference || `GoCardless Payout - ${payout.id}`,
                amount: (payout.amount / 100).toString(),
                reconciled: false,
                custom_data: {
                    gocardless_id: payout.id,
                    payment_id: payout.id,
                    payout_id: payout.id,
                    status: payout.status,
                    type: "payout",
                    currency: payout.currency,
                    created_at: payout.created_at,
                    destinationAccount: "bankinter-eur",
                },
            }));

            // Payment rows (enriched with customer data)
            const paymentRows = payments
                .filter((p) => p.status !== "cancelled" && p.status !== "failed")
                .map((payment) => {
                    const enrichment = enrichmentMap.get(payment.id);
                    const customerName = enrichment?.customer_name || null;
                    const customerEmail = enrichment?.customer_email || null;

                    return {
                        id: `gocardless-payment-${payment.id}`,
                        file_name: "gocardless-api-sync",
                        source: "gocardless",
                        date: payment.charge_date || payment.created_at?.split("T")[0],
                        description: customerName
                            ? `${customerName} - Direct Debit`
                            : payment.reference || payment.description || `GoCardless Payment - ${payment.id}`,
                        amount: (payment.amount / 100).toString(),
                        reconciled: false,
                        customer_name: customerName,
                        customer_email: customerEmail,
                        custom_data: {
                            gocardless_id: payment.id,
                            payment_id: payment.id,
                            payout_id: payment.payout_id || null,
                            status: payment.status,
                            type: "payment",
                            currency: "EUR",
                            customer_name: customerName,
                            customer_email: customerEmail,
                            company_name: enrichment?.company_name || null,
                            subscription_name: enrichment?.subscription_name || null,
                            mandate_id: enrichment?.mandate_id || null,
                            gc_subscription_id: enrichment?.gc_subscription_id || null,
                            gc_customer_id: enrichment?.gc_customer_id || null,
                            payment_method: "direct_debit",
                            created_at: payment.created_at,
                        },
                    };
                });

            const allRows = [...payoutRows, ...paymentRows];
            let upsertCount = 0;
            for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
                const batch = allRows.slice(i, i + BATCH_SIZE);
                const { error } = await supabaseAdmin
                    .from("csv_rows")
                    .upsert(batch, { onConflict: "id" });
                if (error) {
                    console.error(`[GoCardless] Upsert batch error:`, error.message);
                } else {
                    upsertCount += batch.length;
                }
            }
            console.log(`[GoCardless] ✅ Upserted ${upsertCount} rows to csv_rows`);
        }

        // Return summary
        return {
            success: true,
            payoutsCount: payouts.length,
            paymentsCount: payments.length,
        };
    } catch (error) {
        console.error("Error syncing GoCardless transactions:", error);
        return {
            success: false,
            payoutsCount: 0,
            paymentsCount: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Tests the GoCardless API connection
 */
export async function testGoCardlessConnection(): Promise<{
    success: boolean;
    message: string;
    creditor?: string;
}> {
    if (!GOCARDLESS_TOKEN) {
        return {
            success: false,
            message: "GOCARDLESS_ACCESS_TOKEN is not configured",
        };
    }

    try {
        const response = await fetch(`${GOCARDLESS_API_URL}/creditors`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${GOCARDLESS_TOKEN}`,
                "GoCardless-Version": "2015-07-06",
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return {
                success: false,
                message: `API error: ${response.status} ${response.statusText} - ${errorBody}`,
            };
        }

        const data = await response.json();
        const creditor = data.creditors?.[0];

        return {
            success: true,
            message: "Connection successful",
            creditor: creditor?.name || creditor?.id,
        };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
