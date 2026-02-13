/**
 * API Endpoint: Reconciliação Completa Multi-Banco — Pipeline v2
 * 
 * POST /api/reconcile/run-all
 * 
 * Pipeline completo em 9 fases sequenciais:
 * 
 *   FASE 1 — ENRICHMENT (preparação de dados)
 *     1. cross-reference     → enriquece ar_invoices com order_id do HubSpot
 *     2. braintree-orders    → liga Braintree transactions a invoice-orders
 *
 *   FASE 2 — GATEWAY → INVOICE (revenue recognition)
 *     3. auto                → AR Invoices ↔ Gateway payments (6 estratégias)
 *
 *   FASE 3 — BANK → GATEWAY (cash reconciliation)
 *     4. bank-disbursement   → Bank ↔ Disbursement aggregates (por banco)
 *     5. stripe-bankinter    → Stripe payouts ↔ Bankinter
 *     6. gocardless-bankinter→ GoCardless payouts ↔ Bankinter
 *
 *   FASE 4 — CHAIN (full flow Order→BT→Disbursement→Bank)
 *     7. disbursement-chain  → cadeia completa EUR + USD
 *
 *   FASE 5 — DEEP (catch remaining with wider tolerances)
 *     8. deep                → 8 níveis progressivos
 *
 *   FASE 6 — FALLBACK
 *     9. web-orders-bank     → Web Orders → Bank (último recurso)
 * 
 * Body: { dryRun?: boolean, banks?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";

const ALL_BANKS = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];

interface BankResult {
    bankSource: string;
    success: boolean;
    matched: number;
    unmatched: number;
    total: number;
    bySource?: Record<string, number>;
    totalValue?: number;
    error?: string;
}

/** Helper to call an internal API safely */
async function callApi(baseUrl: string, path: string, body: Record<string, any>): Promise<any> {
    try {
        const res = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return await res.json();
    } catch (err: any) {
        return { success: false, error: err.message || "Failed to call" };
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;
        const banks: string[] = body.banks || ALL_BANKS;

        const baseUrl = req.nextUrl.origin;
        const startTime = Date.now();
        const pipelineResults: Record<string, any> = {};

        // ═══════════════════════════════════════════════════
        // FASE 1 — ENRICHMENT (enriquecer dados antes do matching)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 1: Enrichment...");

        // 1a. Cross-reference: enriquece ar_invoices com order_id do HubSpot/invoice-orders
        pipelineResults.crossReference = await callApi(baseUrl, "/api/ar-invoices/cross-reference", { dryRun });
        const crossRefMatched = pipelineResults.crossReference?.summary?.matched || pipelineResults.crossReference?.matched || 0;
        console.log(`[run-all]   cross-reference: ${crossRefMatched} enriched`);

        // 1b. Braintree ↔ Invoice-Orders (order_id/email/amount/name/partial-id matching)
        const btOrdersUrl = `${baseUrl}/api/reconciliation/braintree-orders?strategy=all&dryRun=${dryRun ? "1" : "0"}`;
        try {
            const btOrdRes = await fetch(btOrdersUrl, { method: "POST" });
            pipelineResults.braintreeOrders = await btOrdRes.json();
        } catch {
            pipelineResults.braintreeOrders = { success: false, error: "Failed to call" };
        }
        const btOrdersMatched = pipelineResults.braintreeOrders?.data?.totalMatched || 0;
        console.log(`[run-all]   braintree-orders: ${btOrdersMatched} matched`);

        // ═══════════════════════════════════════════════════
        // FASE 2 — GATEWAY → INVOICE (revenue recognition)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 2: Gateway → Invoice matching...");

        // 3. AR Invoices auto-reconciliation (6 strategies: order_id, email, domain, amount+date, company, name)
        pipelineResults.arInvoicesAuto = await callApi(baseUrl, "/api/reconcile/auto", { dryRun });
        const arAutoMatched = pipelineResults.arInvoicesAuto?.summary?.matched || 0;
        console.log(`[run-all]   ar-invoices auto: ${arAutoMatched} matched`);

        // ═══════════════════════════════════════════════════
        // FASE 3 — BANK → GATEWAY (cash reconciliation)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 3: Bank → Gateway reconciliation...");

        const bankResults: BankResult[] = [];

        // 4. Bank ↔ Disbursement (sequential per bank)
        for (const bankSource of banks) {
            const data = await callApi(baseUrl, "/api/reconcile/bank-disbursement", { bankSource, dryRun });
            if (data.success) {
                bankResults.push({
                    bankSource,
                    success: true,
                    matched: data.matched || 0,
                    unmatched: data.unmatched || 0,
                    total: data.total || 0,
                    bySource: data.summary?.bySource || {},
                    totalValue: data.summary?.totalValue || 0,
                });
            } else {
                bankResults.push({
                    bankSource, success: false, matched: 0, unmatched: 0, total: 0,
                    error: data.error || "Unknown error",
                });
            }
        }

        // 5. Stripe ↔ Bankinter
        pipelineResults.stripeBankinter = await callApi(baseUrl, "/api/reconcile/stripe-bankinter", { dryRun });
        console.log(`[run-all]   stripe-bankinter: ${pipelineResults.stripeBankinter?.matched || 0} matched`);

        // 6. GoCardless ↔ Bankinter
        pipelineResults.gocardlessBankinter = await callApi(baseUrl, "/api/reconcile/gocardless-bankinter", { dryRun });
        console.log(`[run-all]   gocardless-bankinter: ${pipelineResults.gocardlessBankinter?.matched || 0} matched`);

        // ═══════════════════════════════════════════════════
        // FASE 4 — CHAIN (full flow: Order → BT → Disbursement → Bank)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 4: Disbursement chain...");

        // 7. Disbursement chain EUR + USD
        pipelineResults.disbursementChainEUR = await callApi(baseUrl, "/api/reconcile/disbursement-chain", { dryRun, currency: "EUR" });
        pipelineResults.disbursementChainUSD = await callApi(baseUrl, "/api/reconcile/disbursement-chain", { dryRun, currency: "USD" });
        const chainEurMatched = pipelineResults.disbursementChainEUR?.stats?.bank_rows_reconciled || 0;
        const chainUsdMatched = pipelineResults.disbursementChainUSD?.stats?.bank_rows_reconciled || 0;
        console.log(`[run-all]   disbursement-chain: EUR=${chainEurMatched} USD=${chainUsdMatched}`);

        // ═══════════════════════════════════════════════════
        // FASE 5 — DEEP (catch remaining with wider tolerances)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 5: Deep reconciliation...");

        // 8. Deep 8-level multi-strategy
        pipelineResults.deepReconciliation = await callApi(baseUrl, "/api/reconcile/deep", { dryRun, banks });
        const deepMatched = pipelineResults.deepReconciliation?.summary?.matched || 0;
        const deepValue = pipelineResults.deepReconciliation?.summary?.totalValue || 0;
        console.log(`[run-all]   deep: ${deepMatched} matched`);

        // ═══════════════════════════════════════════════════
        // FASE 6 — FALLBACK (last resort)
        // ═══════════════════════════════════════════════════
        console.log("[run-all] FASE 6: Fallback web-orders-bank...");

        // 9. Web Orders → Bank (último recurso)
        pipelineResults.webOrdersBank = await callApi(baseUrl, "/api/reconcile/web-orders-bank", { dryRun });
        const webOrdersMatched = pipelineResults.webOrdersBank?.stats?.matched || pipelineResults.webOrdersBank?.matched || 0;
        console.log(`[run-all]   web-orders-bank: ${webOrdersMatched} matched`);

        // ═══════════════════════════════════════════════════
        // SUMMARY
        // ═══════════════════════════════════════════════════

        const bankTotalMatched = bankResults.reduce((sum, r) => sum + r.matched, 0);
        const bankTotalUnmatched = bankResults.reduce((sum, r) => sum + r.unmatched, 0);
        const bankTotalValue = bankResults.reduce((sum, r) => sum + (r.totalValue || 0), 0);

        const allMatched = bankTotalMatched + deepMatched + chainEurMatched + chainUsdMatched + webOrdersMatched;
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`[run-all] COMPLETE in ${duration}s — Total matched: ${allMatched}`);

        return NextResponse.json({
            success: true,
            dryRun,
            duration: `${duration}s`,
            summary: {
                totalMatched: allMatched,
                totalUnmatched: Math.max(0, bankTotalUnmatched - deepMatched),
                totalValue: Math.round((bankTotalValue + deepValue) * 100) / 100,
                banksProcessed: bankResults.filter(r => r.success).length,
                banksTotal: banks.length,
                pipeline: {
                    enrichment: {
                        crossReference: crossRefMatched,
                        braintreeOrders: btOrdersMatched,
                    },
                    revenueRecognition: {
                        arInvoicesAuto: arAutoMatched,
                        bySource: pipelineResults.arInvoicesAuto?.summary?.bySource || {},
                    },
                    cashReconciliation: {
                        bankDisbursement: bankTotalMatched,
                        stripeBankinter: pipelineResults.stripeBankinter?.matched || 0,
                        gocardlessBankinter: pipelineResults.gocardlessBankinter?.matched || 0,
                    },
                    chain: {
                        disbursementChainEUR: chainEurMatched,
                        disbursementChainUSD: chainUsdMatched,
                    },
                    deep: {
                        matched: deepMatched,
                        value: deepValue,
                        byLevel: pipelineResults.deepReconciliation?.summary?.byLevel || {},
                    },
                    fallback: {
                        webOrdersBank: webOrdersMatched,
                    },
                },
                arInvoicesReconciled: arAutoMatched,
            },
            banks: bankResults,
            specialReconciliations: pipelineResults,
        });

    } catch (error: any) {
        console.error("[Run-All Reconcile API] Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
