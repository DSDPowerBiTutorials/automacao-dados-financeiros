/**
 * Cron Job Unificado: Sincronização Diária de Todos os Sistemas
 * 
 * Executa: Todos os dias às 4h da manhã (UTC)
 * 
 * Sincroniza em ordem:
 * 1. Braintree (EUR + USD) - Últimos 7 dias
 * 2. GoCardless - Últimos 30 dias
 * 3. HubSpot - Deals desde 2024
 * 4. Products - Novos produtos do HubSpot
 * 4b. AR Invoices from HubSpot
 * 4c. Customer Master Data Sync (cross-ref all sources)
 * 5. Stripe (EUR + USD) - Últimos 7 dias
 * 6. QuickBooks (USD) - Últimos 30 dias (Escopo EUA)
 * 7. Reconciliação Automática - AR Invoices x Braintree/Stripe/GoCardless
 * 
 * Endpoint: GET /api/cron/daily-sync
 * Autorização: Bearer ${CRON_SECRET} ou x-vercel-cron header
 * 
 * 🤖 Executado por: BOTella
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { syncGoCardlessTransactions } from "@/lib/gocardless";
import { syncAllQuickBooksData, testConnection as testQuickBooksConnection } from "@/lib/quickbooks";
import {
    startBotTask,
    completeBotTask,
    failBotTask,
    warnBotTask,
    BOT_CONSOLE_NAME
} from "@/lib/botella";


interface SyncResult {
    name: string;
    success: boolean;
    message: string;
    count?: number;
    duration_ms: number;
    error?: string;
}

export const maxDuration = 300; // Vercel Hobby plan max

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    const results: SyncResult[] = [];

    // Verificar autorização
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get("x-vercel-cron") !== null;

    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🤖 BOTella: Iniciar tarefa de sincronização
    let botContext;
    try {
        botContext = await startBotTask("Sincronização Diária", "sync", "Iniciando sincronização de todos os sistemas");
    } catch (e) {
        console.warn(`${BOT_CONSOLE_NAME} Não foi possível criar log (tabela pode não existir ainda)`);
    }

    console.log(`${BOT_CONSOLE_NAME} 🚀 [Daily Sync] Iniciando sincronização unificada...`);
    console.log(`📅 Data: ${new Date().toISOString()}`);

    // ============================================
    // 1. BRAINTREE EUR
    // ============================================
    try {
        const braintreeStart = Date.now();
        console.log("\n📦 [1/5] Sincronizando Braintree EUR...");

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/braintree/sync`;

        const response = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                startDate: startDate.toISOString().split("T")[0],
                endDate: endDate.toISOString().split("T")[0],
                currency: "EUR",
            }),
        });

        const result = await response.json();

        results.push({
            name: "Braintree EUR",
            success: result.success === true,
            message: result.message || "Sync completed",
            count: result.inserted || 0,
            duration_ms: Date.now() - braintreeStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "Braintree EUR",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 2. BRAINTREE USD
    // ============================================
    try {
        const braintreeUsdStart = Date.now();
        console.log("\n💵 [2/5] Sincronizando Braintree USD...");

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/braintree/sync`;

        const response = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                startDate: startDate.toISOString().split("T")[0],
                endDate: endDate.toISOString().split("T")[0],
                currency: "USD",
            }),
        });

        const result = await response.json();

        results.push({
            name: "Braintree USD",
            success: result.success === true,
            message: result.message || "Sync completed",
            count: result.inserted || 0,
            duration_ms: Date.now() - braintreeUsdStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "Braintree USD",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 3. GOCARDLESS
    // ============================================
    try {
        const gcStart = Date.now();
        console.log("\n🏦 [3/5] Sincronizando GoCardless...");

        const result = await syncGoCardlessTransactions();

        results.push({
            name: "GoCardless",
            success: result.success === true,
            message: `${result.payoutsCount || 0} payouts, ${result.paymentsCount || 0} payments`,
            count: (result.payoutsCount || 0) + (result.paymentsCount || 0),
            duration_ms: Date.now() - gcStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "GoCardless",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 4. HUBSPOT DEALS (via API enriquecida)
    // ============================================
    try {
        const hubspotStart = Date.now();
        console.log("\n📊 [4/5] Sincronizando HubSpot Deals (API enriquecida)...");

        const hubspotUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/hubspot/sync`;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const response = await fetch(hubspotUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate: thirtyDaysAgo.toISOString().split('T')[0] }),
        });
        const result = await response.json();

        results.push({
            name: "HubSpot Deals",
            success: result.success === true,
            message: result.success
                ? `${result.totalSynced || 0} deals synced (enriched query)`
                : result.error,
            count: result.totalSynced || 0,
            duration_ms: Date.now() - hubspotStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "HubSpot Deals",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 4b. GERAR INVOICES AR A PARTIR DO HUBSPOT
    // ============================================
    try {
        const arStart = Date.now();
        console.log("\n🧾 [4b/5] Gerando invoices AR a partir do HubSpot...");
        const arUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ar-invoices/from-hubspot`;
        const response = await fetch(arUrl, { method: "POST" });
        const result = await response.json();
        results.push({
            name: "AR Invoices from HubSpot",
            success: result.success === true,
            message: result.success ? `Criadas: ${result.created}, Skipped: ${result.skipped}` : result.error,
            count: result.created || 0,
            duration_ms: Date.now() - arStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "AR Invoices from HubSpot",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 4b2. GERAR INVOICES AR A PARTIR DO QUICKBOOKS
    // ============================================
    try {
        const qbArStart = Date.now();
        console.log("\n🧾 [4b2] Gerando invoices AR a partir do QuickBooks...");
        const qbArUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ar-invoices/from-quickbooks`;
        const response = await fetch(qbArUrl, { method: "POST" });
        const result = await response.json();
        results.push({
            name: "AR Invoices from QuickBooks",
            success: result.success === true,
            message: result.success
                ? `Created: ${result.created}, Emails: ${result.emailsEnriched}, FA history: ${result.faFromHistory}, FA default: ${result.faDefault}`
                : result.error,
            count: result.created || 0,
            duration_ms: Date.now() - qbArStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "AR Invoices from QuickBooks",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 4c. CUSTOMER MASTER DATA SYNC
    // ============================================
    try {
        const custStart = Date.now();
        console.log("\n👥 [4c] Syncing Customer Master Data...");
        const custUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/customers/sync`;
        const response = await fetch(custUrl, { method: "POST" });
        const result = await response.json();
        results.push({
            name: "Customer Sync",
            success: result.success === true,
            message: result.success ? result.message : result.error,
            count: (result.stats?.customers_created || 0) + (result.stats?.customers_updated || 0),
            duration_ms: Date.now() - custStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "Customer Sync",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 5. PRODUCTS (do HubSpot LineItem)
    // ============================================
    try {
        const productsStart = Date.now();
        console.log("\n📦 [5/5] Sincronizando Products...");

        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/products/sync`;
        const response = await fetch(syncUrl);
        const result = await response.json();

        results.push({
            name: "Products",
            success: result.success === true,
            message: result.message || "Sync completed",
            count: result.stats?.inserted || 0,
            duration_ms: Date.now() - productsStart,
            error: result.error,
        });
    } catch (error: any) {
        results.push({
            name: "Products",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 6. STRIPE (EUR + USD)
    // ============================================
    try {
        const stripeStart = Date.now();
        console.log("\n💳 [6/6] Sincronizando Stripe...");

        const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/stripe/sync`;

        // Sync EUR
        const eurResponse = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currency: "EUR",
                sinceDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            }),
        });
        const eurResult = await eurResponse.json();

        // Sync USD
        const usdResponse = await fetch(syncUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                currency: "USD",
                sinceDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            }),
        });
        const usdResult = await usdResponse.json();

        const totalCharges = (eurResult.summary?.charges_synced || 0) + (usdResult.summary?.charges_synced || 0);
        const success = eurResult.success !== false && usdResult.success !== false;

        results.push({
            name: "Stripe",
            success,
            message: `EUR: ${eurResult.summary?.charges_synced || 0}, USD: ${usdResult.summary?.charges_synced || 0}`,
            count: totalCharges,
            duration_ms: Date.now() - stripeStart,
            error: eurResult.error || usdResult.error,
        });
    } catch (error: any) {
        results.push({
            name: "Stripe",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 7. QUICKBOOKS (USD - Escopo EUA)
    // ============================================
    try {
        const quickbooksStart = Date.now();
        console.log("\n🇺🇸 [7/7] Sincronizando QuickBooks USD (EUA)...");

        // Verificar se QuickBooks está conectado
        const connectionTest = await testQuickBooksConnection();

        if (!connectionTest.connected) {
            console.log("⚠️ QuickBooks não conectado, pulando sincronização");
            results.push({
                name: "QuickBooks USD",
                success: true,
                message: "Skipped - Not connected",
                count: 0,
                duration_ms: Date.now() - quickbooksStart,
            });
        } else {
            // Sincronizar últimos 30 dias
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split("T")[0];

            const qbResult = await syncAllQuickBooksData(startDate);

            const totalCount = (qbResult.invoices?.count || 0) +
                (qbResult.payments?.count || 0) +
                (qbResult.bills?.count || 0) +
                (qbResult.expenses?.count || 0);

            results.push({
                name: "QuickBooks USD",
                success: qbResult.success,
                message: qbResult.success
                    ? `Inv: ${qbResult.invoices?.count || 0}, Pay: ${qbResult.payments?.count || 0}, Bills: ${qbResult.bills?.count || 0}, Exp: ${qbResult.expenses?.count || 0}`
                    : qbResult.error || "Failed",
                count: totalCount,
                duration_ms: Date.now() - quickbooksStart,
                error: qbResult.error,
            });

            // Atualizar sync_metadata específico do QuickBooks
            if (qbResult.success && supabaseAdmin) {
                await supabaseAdmin.from("sync_metadata").upsert(
                    {
                        source: "quickbooks-usd",
                        last_sync_at: new Date().toISOString(),
                        last_incremental_sync_at: new Date().toISOString(),
                        sync_status: "success",
                        records_added_last_sync: totalCount,
                        last_sync_duration_ms: Date.now() - quickbooksStart,
                    },
                    { onConflict: "source" }
                );
            }
        }
    } catch (error: any) {
        console.error("[QuickBooks] Sync error:", error);
        results.push({
            name: "QuickBooks USD",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 8. RECONCILIAÇÃO AUTOMÁTICA AR INVOICES
    // ============================================
    try {
        const reconcileStart = Date.now();
        console.log("\n🔗 [8/11] Reconciliação Automática AR (Braintree/Stripe/GoCardless)...");

        const reconcileUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reconcile/auto`;

        const response = await fetch(reconcileUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dryRun: false }),
        });
        const result = await response.json();

        if (result.success) {
            results.push({
                name: "AR Reconciliation",
                success: true,
                message: `BT: ${result.summary.bySource.braintree}, ST: ${result.summary.bySource.stripe}, GC: ${result.summary.bySource.gocardless}, HS: ${result.summary.bySource.hubspot_confirmed || 0}`,
                count: result.summary.updated,
                duration_ms: Date.now() - reconcileStart,
            });
        } else {
            throw new Error(result.error || "Reconciliation failed");
        }
    } catch (error: any) {
        console.error("[AR Reconciliation] Error:", error);
        results.push({
            name: "AR Reconciliation",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 9. RECONCILIAÇÃO BANCÁRIA COMPLETA (run-all pipeline)
    // ============================================
    try {
        const bankReconStart = Date.now();
        console.log("\n🏦 [9/11] Reconciliação Bancária Completa (Bank ↔ Gateway/Disbursement)...");

        const runAllUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reconcile/run-all`;

        const response = await fetch(runAllUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dryRun: false }),
        });
        const result = await response.json();

        if (result.success) {
            results.push({
                name: "Bank Reconciliation",
                success: true,
                message: `Matched: ${result.summary.totalMatched}, Banks: ${result.summary.banksProcessed}/${result.summary.banksTotal}`,
                count: result.summary.totalMatched,
                duration_ms: Date.now() - bankReconStart,
            });
        } else {
            throw new Error(result.error || "Bank reconciliation failed");
        }
    } catch (error: any) {
        console.error("[Bank Reconciliation] Error:", error);
        results.push({
            name: "Bank Reconciliation",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 10. RECONCILIAÇÃO AP INVOICES ↔ BANCO
    // ============================================
    try {
        const apBankStart = Date.now();
        console.log("\n📋 [10/11] Reconciliação AP Invoices ↔ Bank Debits...");

        const apBankUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reconcile/ap-bank`;

        const response = await fetch(apBankUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dryRun: false }),
        });
        const result = await response.json();

        if (result.success) {
            results.push({
                name: "AP Bank Reconciliation",
                success: true,
                message: `Matched: ${result.summary.matched} of ${result.summary.invoices} invoices (${JSON.stringify(result.summary.byStrategy)})`,
                count: result.summary.applied || result.summary.matched,
                duration_ms: Date.now() - apBankStart,
            });
        } else {
            throw new Error(result.error || "AP Bank reconciliation failed");
        }
    } catch (error: any) {
        console.error("[AP Bank Reconciliation] Error:", error);
        results.push({
            name: "AP Bank Reconciliation",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 11. RECONCILIAÇÃO PAGAMENTOS AGENDADOS/FEITOS
    // ============================================
    try {
        const apSchedStart = Date.now();
        console.log("\n📅 [11/11] Reconciliação Pagamentos Agendados/Feitos...");

        const apSchedUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reconcile/ap-scheduled`;

        const response = await fetch(apSchedUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dryRun: false }),
        });
        const result = await response.json();

        if (result.success) {
            results.push({
                name: "AP Scheduled Reconciliation",
                success: true,
                message: `Matched: ${result.summary.matched}, Needs review: ${result.summary.needsReview}`,
                count: result.summary.applied || result.summary.matched,
                duration_ms: Date.now() - apSchedStart,
            });
        } else {
            throw new Error(result.error || "AP Scheduled reconciliation failed");
        }
    } catch (error: any) {
        console.error("[AP Scheduled Reconciliation] Error:", error);
        results.push({
            name: "AP Scheduled Reconciliation",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // 12. COTAÇÃO DIÁRIA EUR/USD (Frankfurter / ECB)
    // ============================================
    try {
        const fxStart = Date.now();
        console.log("\n💱 [12/12] Buscando cotação EUR/USD...");

        const fxRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR");
        if (!fxRes.ok) throw new Error(`Frankfurter API ${fxRes.status}`);
        const fxData = await fxRes.json();
        const usdToEur = fxData.rates?.EUR;
        if (!usdToEur) throw new Error("No EUR rate in response");

        await supabaseAdmin.from("sync_metadata").upsert(
            {
                source: "exchange-rate",
                last_sync: new Date().toISOString(),
                records_synced: 1,
                metadata: {
                    usd_to_eur: usdToEur,
                    eur_to_usd: 1 / usdToEur,
                    date: fxData.date,
                    fetched_at: new Date().toISOString(),
                },
            },
            { onConflict: "source" }
        );

        results.push({
            name: "Exchange Rate EUR/USD",
            success: true,
            message: `1 USD = ${usdToEur.toFixed(4)} EUR (ECB ${fxData.date})`,
            count: 1,
            duration_ms: Date.now() - fxStart,
        });
        console.log(`   ✅ 1 USD = ${usdToEur.toFixed(4)} EUR`);
    } catch (error: any) {
        console.error("[Exchange Rate] Error:", error);
        results.push({
            name: "Exchange Rate EUR/USD",
            success: false,
            message: "Failed to fetch exchange rate",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // SALVAR METADATA DA SINCRONIZAÇÃO
    // ============================================
    const totalDuration = Date.now() - startTime;
    const totalSteps = results.length;
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + (r.count || 0), 0);

    try {
        await supabaseAdmin.from("sync_metadata").upsert(
            {
                source: "daily-sync",
                last_sync: new Date().toISOString(),
                records_synced: totalRecords,
                metadata: {
                    results,
                    duration_ms: totalDuration,
                    success_count: successCount,
                    fail_count: failCount,
                },
            },
            { onConflict: "source" }
        );
    } catch (e) {
        console.error("Failed to save sync metadata:", e);
    }

    // 🤖 BOTella: Finalizar tarefa
    if (botContext) {
        try {
            botContext.recordsProcessed = totalRecords;
            botContext.recordsCreated = results.reduce((sum, r) => sum + (r.count || 0), 0);
            botContext.recordsFailed = failCount;

            if (failCount === 0) {
                await completeBotTask(
                    botContext,
                    `Sincronização concluída: ${successCount}/${totalSteps} sistemas`,
                    { results, successCount, failCount }
                );
            } else if (successCount > 0) {
                await warnBotTask(
                    botContext,
                    `Sincronização parcial: ${successCount}/${totalSteps} ok, ${failCount} falhas`,
                    { results, successCount, failCount }
                );
            } else {
                await failBotTask(
                    botContext,
                    `Sincronização falhou: ${failCount}/${totalSteps} erros`,
                    { results, successCount, failCount }
                );
            }
        } catch (e) {
            console.warn(`${BOT_CONSOLE_NAME} Não foi possível atualizar log`);
        }
    }

    // ============================================
    // RESPOSTA FINAL
    // ============================================
    console.log(`\n${BOT_CONSOLE_NAME} ✅ [Daily Sync] Sincronização concluída!`);
    console.log(`   ⏱️ Duração total: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`   ✓ Sucesso: ${successCount}/${totalSteps}`);
    console.log(`   ✗ Falhas: ${failCount}/${totalSteps}`);

    return NextResponse.json({
        success: failCount === 0,
        message: `Daily sync completed: ${successCount}/${totalSteps} successful`,
        duration_ms: totalDuration,
        timestamp: new Date().toISOString(),
        bot: "BOTella",
        results,
    });
}
