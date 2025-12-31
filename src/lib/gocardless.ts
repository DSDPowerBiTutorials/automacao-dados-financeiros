/**
 * GoCardless API Integration
 * Handles synchronization with GoCardless API to fetch payments and payouts
 */

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
 * Fetches all payouts from GoCardless
 */
export async function fetchGoCardlessPayouts(): Promise<GoCardlessPayout[]> {
    if (!GOCARDLESS_TOKEN) {
        throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured");
    }

    try {
        const response = await fetch(`${GOCARDLESS_API_URL}/payouts`, {
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
        return data.payouts || [];
    } catch (error) {
        console.error("Error fetching GoCardless payouts:", error);
        throw error;
    }
}

/**
 * Fetches all payments from GoCardless
 */
export async function fetchGoCardlessPayments(): Promise<GoCardlessPayment[]> {
    if (!GOCARDLESS_TOKEN) {
        throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured");
    }

    try {
        const response = await fetch(`${GOCARDLESS_API_URL}/payments`, {
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
        return data.payments || [];
    } catch (error) {
        console.error("Error fetching GoCardless payments:", error);
        throw error;
    }
}

/**
 * Syncs GoCardless transactions to Supabase
 */
export async function syncGoCardlessTransactions(): Promise<{
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
            fetchGoCardlessPayouts(),
            fetchGoCardlessPayments(),
        ]);

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
