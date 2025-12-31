import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
    fetchGoCardlessPayouts,
    fetchGoCardlessPayments,
    testGoCardlessConnection,
} from "@/lib/gocardless";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        // Test connection first
        const connectionTest = await testGoCardlessConnection();
        if (!connectionTest.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: `GoCardless connection failed: ${connectionTest.message}`,
                },
                { status: 400 },
            );
        }

        // Fetch payouts and payments
        const [payouts, payments] = await Promise.all([
            fetchGoCardlessPayouts(),
            fetchGoCardlessPayments(),
        ]);

        // Prepare rows for insertion
        const rows: any[] = [];

        // Add payouts
        payouts.forEach((payout) => {
            rows.push({
                source: "gocardless",
                date: payout.arrival_date || payout.created_at,
                description: payout.reference || `GoCardless Payout - ${payout.id}`,
                amount: (payout.amount / 100).toString(), // Convert from cents to currency
                reconciled: false,
                custom_data: {
                    type: "payout",
                    payout_id: payout.id,
                    currency: payout.currency,
                    status: payout.status,
                    gocardless_id: payout.id,
                    sync_timestamp: new Date().toISOString(),
                },
            });
        });

        // Add payments
        payments.forEach((payment) => {
            rows.push({
                source: "gocardless",
                date: payment.charge_date || payment.created_at,
                description:
                    payment.reference ||
                    payment.description ||
                    `GoCardless Payment - ${payment.id}`,
                amount: (payment.amount / 100).toString(), // Convert from cents to currency
                reconciled: false,
                custom_data: {
                    type: "payment",
                    payment_id: payment.id,
                    payout_id: payment.payout_id,
                    status: payment.status,
                    gocardless_id: payment.id,
                    sync_timestamp: new Date().toISOString(),
                },
            });
        });

        if (rows.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No new transactions to sync",
                payoutsCount: 0,
                paymentsCount: 0,
            });
        }

        // Insert or update rows in Supabase
        // Use id field from gocardless_id to avoid duplicates
        const rowsWithIds = rows.map(row => ({
            ...row,
            id: `gocardless_${row.custom_data.gocardless_id}` // Create unique ID
        }));

        const { data, error } = await supabase
            .from("csv_rows")
            .upsert(rowsWithIds, { onConflict: "id" });

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json(
                {
                    success: false,
                    error: `Failed to save to database: ${error.message}`,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: "GoCardless sync completed",
            payoutsCount: payouts.length,
            paymentsCount: payments.length,
            rowsSynced: rows.length,
            creditor: connectionTest.creditor,
        });
    } catch (error) {
        console.error("Error in GoCardless sync:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        // Test connection
        const connectionTest = await testGoCardlessConnection();

        if (!connectionTest.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: connectionTest.message,
                },
                { status: 400 },
            );
        }

        // Fetch stats
        const [payouts, payments] = await Promise.all([
            fetchGoCardlessPayouts(),
            fetchGoCardlessPayments(),
        ]);

        const totalPayoutAmount = payouts.reduce((sum, p) => sum + p.amount, 0);
        const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amount, 0);

        return NextResponse.json({
            success: true,
            connection: {
                status: "connected",
                creditor: connectionTest.creditor,
            },
            stats: {
                payoutsCount: payouts.length,
                paymentsCount: payments.length,
                totalPayoutAmount: (totalPayoutAmount / 100).toFixed(2), // Convert from cents
                totalPaymentAmount: (totalPaymentAmount / 100).toFixed(2),
            },
        });
    } catch (error) {
        console.error("Error in GoCardless stats:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 },
        );
    }
}
