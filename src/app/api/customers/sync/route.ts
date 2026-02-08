/**
 * Customer Sync API - Automated customer master data synchronization
 * 
 * POST /api/customers/sync
 * 
 * Runs the full homogenization pipeline:
 * 1. Analyzes invoice-orders for unique customers
 * 2. Cross-references with all revenue sources (Braintree, HubSpot, Stripe) for emails
 * 3. Updates csv_rows with normalized customer_name/customer_email
 * 4. Upserts into customers master data table
 * 
 * Called by:
 * - Daily cron (/api/cron/daily-sync)
 * - After HubSpot web orders sync
 * - Manual trigger from Customers page
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // 2 minutes max

export async function POST(req: NextRequest) {
    const startTime = Date.now();

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        // Step 1: Run analysis (GET /api/customers/homogenize)
        console.log("👥 [Customer Sync] Step 1: Analyzing customers...");
        const analyzeRes = await fetch(`${baseUrl}/api/customers/homogenize`);
        const analyzeData = await analyzeRes.json();

        if (!analyzeData.success) {
            throw new Error(`Analysis failed: ${analyzeData.error}`);
        }

        const { stats, customers } = analyzeData;
        console.log(`👥 [Customer Sync] Found ${stats.unique_customers} customers, ${stats.cross_ref_enriched} enriched via cross-ref, ${stats.customers_without_email} without email`);

        if (!customers || customers.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No customers to sync",
                duration_ms: Date.now() - startTime,
            });
        }

        // Step 2: Execute homogenization (POST /api/customers/homogenize)
        console.log("👥 [Customer Sync] Step 2: Executing homogenization...");
        const execRes = await fetch(`${baseUrl}/api/customers/homogenize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customers }),
        });
        const execData = await execRes.json();

        if (!execData.success) {
            throw new Error(`Execution failed: ${execData.error}`);
        }

        const duration = Date.now() - startTime;
        console.log(`👥 [Customer Sync] Complete in ${(duration / 1000).toFixed(1)}s — Created: ${execData.results.customers_created}, Updated: ${execData.results.customers_updated}, Invoices annotated: ${execData.results.invoices_annotated}`);

        return NextResponse.json({
            success: true,
            message: `Customers synced: ${execData.results.customers_created} created, ${execData.results.customers_updated} updated`,
            stats: {
                ...stats,
                ...execData.results,
            },
            duration_ms: duration,
        });
    } catch (error: any) {
        console.error("👥 [Customer Sync] Error:", error.message);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                duration_ms: Date.now() - startTime,
            },
            { status: 500 }
        );
    }
}
