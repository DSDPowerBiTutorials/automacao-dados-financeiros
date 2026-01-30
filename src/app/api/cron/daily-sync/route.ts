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
import { getSQLServerConnection } from "@/lib/sqlserver";
import { syncGoCardlessTransactions } from "@/lib/gocardless";
import { syncAllQuickBooksData, testConnection as testQuickBooksConnection } from "@/lib/quickbooks";
import {
    startBotTask,
    completeBotTask,
    failBotTask,
    warnBotTask,
    BOT_CONSOLE_NAME
} from "@/lib/botella";
import crypto from "crypto";

interface SyncResult {
    name: string;
    success: boolean;
    message: string;
    count?: number;
    duration_ms: number;
    error?: string;
}

export const maxDuration = 300; // 5 minutos máximo

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
    // 4. HUBSPOT DEALS
    // ============================================
    try {
        const hubspotStart = Date.now();
        console.log("\n📊 [4/5] Sincronizando HubSpot Deals...");

        const pool = await getSQLServerConnection();

        const result = await pool.request().query(`
            SELECT TOP 5000 *
            FROM [dbo].[Deal]
            WHERE hs_lastmodifieddate >= DATEADD(DAY, -30, GETDATE())
            ORDER BY hs_lastmodifieddate DESC
        `);

        if (result.recordset.length > 0) {
            const rows = result.recordset.map((row: any) => {
                const customData: Record<string, any> = {};
                Object.keys(row).forEach((key) => {
                    if (row[key] !== null && row[key] !== undefined) {
                        customData[key] = row[key];
                    }
                });

                return {
                    id: crypto.randomUUID(),
                    source: "hubspot",
                    date: row.closedate || row.createdate || new Date().toISOString(),
                    description: row.dealname || "HubSpot Deal",
                    amount: parseFloat(row.amount) || 0,
                    currency: row.deal_currency_code || "EUR",
                    reconciled: false,
                    file_name: "hubspot-sync",
                    custom_data: customData,
                };
            });

            const { error } = await supabaseAdmin.from("csv_rows").upsert(rows, {
                onConflict: "id",
                ignoreDuplicates: false,
            });

            results.push({
                name: "HubSpot Deals",
                success: !error,
                message: error ? error.message : `${rows.length} deals synced`,
                count: rows.length,
                duration_ms: Date.now() - hubspotStart,
                error: error?.message,
            });
        } else {
            results.push({
                name: "HubSpot Deals",
                success: true,
                message: "No new deals",
                count: 0,
                duration_ms: Date.now() - hubspotStart,
            });
        }
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
        console.log("\n🔗 [8/8] Reconciliação Automática (Braintree/Stripe/GoCardless)...");

        const reconcileUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/reconcile/auto`;

        const response = await fetch(reconcileUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dryRun: false }),
        });
        const result = await response.json();

        if (result.success) {
            results.push({
                name: "Reconciliation",
                success: true,
                message: `BT: ${result.summary.bySource.braintree}, ST: ${result.summary.bySource.stripe}, GC: ${result.summary.bySource.gocardless}`,
                count: result.summary.updated,
                duration_ms: Date.now() - reconcileStart,
            });
        } else {
            throw new Error(result.error || "Reconciliation failed");
        }
    } catch (error: any) {
        console.error("[Reconciliation] Error:", error);
        results.push({
            name: "Reconciliation",
            success: false,
            message: "Failed",
            duration_ms: Date.now() - startTime,
            error: error.message,
        });
    }

    // ============================================
    // SALVAR METADATA DA SINCRONIZAÇÃO
    // ============================================
    const totalDuration = Date.now() - startTime;
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
                    `Sincronização concluída: ${successCount}/8 sistemas`,
                    { results, successCount, failCount }
                );
            } else if (successCount > 0) {
                await warnBotTask(
                    botContext,
                    `Sincronização parcial: ${successCount}/8 ok, ${failCount} falhas`,
                    { results, successCount, failCount }
                );
            } else {
                await failBotTask(
                    botContext,
                    `Sincronização falhou: ${failCount}/8 erros`,
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
    console.log(`   ✓ Sucesso: ${successCount}/8`);
    console.log(`   ✗ Falhas: ${failCount}/8`);

    return NextResponse.json({
        success: failCount === 0,
        message: `Daily sync completed: ${successCount}/8 successful`,
        duration_ms: totalDuration,
        timestamp: new Date().toISOString(),
        bot: "BOTella",
        results,
    });
}
