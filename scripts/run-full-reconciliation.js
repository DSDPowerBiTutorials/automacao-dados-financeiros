#!/usr/bin/env node
/**
 * Script de Orquestração — Conciliação Completa Braintree
 * 
 * Executa os seguintes passos em sequência:
 * 1. Separa transações AMEX de braintree-api-revenue → braintree-amex
 * 2. Executa reconciliação Braintree EUR settlement batches → Bankinter EUR
 * 3. Executa reconciliação Bank ↔ Disbursements (todos os bancos)
 * 4. Executa reconciliação Braintree ↔ Orders/Invoices
 * 5. Executa reconciliação AR Invoices ↔ Pagamentos
 * 6. Relatório final
 * 
 * Usage: node scripts/run-full-reconciliation.js [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DRY_RUN = process.argv.includes("--dry-run");
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ============================================================
// Utilities
// ============================================================

async function fetchAll(source, extraFilters) {
    let all = [];
    let offset = 0;
    while (true) {
        let query = supabase.from("csv_rows").select("*").eq("source", source).range(offset, offset + 999);
        if (extraFilters) query = extraFilters(query);
        const { data } = await query;
        if (!data || !data.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

function log(emoji, msg) {
    console.log(`${emoji} ${msg}`);
}

function section(title) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${"═".repeat(60)}`);
}

async function callAPI(path, body = {}) {
    try {
        const resp = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        return await resp.json();
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ============================================================
// STEP 1: Separate AMEX transactions
// ============================================================

async function step1_separateAMEX() {
    section("PASSO 1 — Separar Transações AMEX");

    // Check if braintree-amex already has data
    const { count: existingAmex } = await supabase
        .from("csv_rows").select("id", { count: "exact", head: true }).eq("source", "braintree-amex");
    log("📊", `braintree-amex existentes: ${existingAmex || 0}`);

    // Find AMEX transactions in braintree-api-revenue
    const btRows = await fetchAll("braintree-api-revenue");
    const amexRows = btRows.filter((r) => {
        const ct = (r.custom_data?.card_type || "").toLowerCase();
        return ct.includes("amex") || ct.includes("american express");
    });
    log("🔍", `Transações AMEX encontradas em braintree-api-revenue: ${amexRows.length}`);

    if (amexRows.length === 0) {
        log("✅", "Nenhuma transação AMEX para separar.");
        return { total: 0, inserted: 0 };
    }

    // Group by disbursement_date to create aggregate rows (AMEX page expects disbursement-level data)
    const byDisbDate = new Map();
    amexRows.forEach((r) => {
        const cd = r.custom_data || {};
        const disbDate = cd.disbursement_date?.split("T")[0] || cd.settlement_date?.split("T")[0] || r.date?.split("T")[0];
        if (!disbDate) return;
        const key = disbDate;
        if (!byDisbDate.has(key)) {
            byDisbDate.set(key, {
                sales: 0, count: 0, transactionIds: [],
                currency: cd.currency || r.currency || "EUR",
                merchantAccount: cd.merchant_account_id || ""
            });
        }
        const g = byDisbDate.get(key);
        const amt = parseFloat(cd.settlement_amount || r.amount || 0);
        g.sales += amt;
        g.count++;
        g.transactionIds.push(cd.transaction_id || r.external_id || r.id);
    });

    // Also create individual transaction rows for AMEX source
    // (since the page can also display individual transactions)
    const amexInserts = [];
    const existingAmexIds = new Set();

    // Check existing IDs in batches
    const allAmexIds = amexRows.map(r => `braintree-amex-${r.custom_data?.transaction_id || r.external_id || r.id}`);
    for (let i = 0; i < allAmexIds.length; i += 1000) {
        const batch = allAmexIds.slice(i, i + 1000);
        const { data: existing } = await supabase.from("csv_rows").select("id").in("id", batch);
        if (existing) existing.forEach(r => existingAmexIds.add(r.id));
    }

    amexRows.forEach((r) => {
        const cd = r.custom_data || {};
        const txId = cd.transaction_id || r.external_id || r.id;
        const amexId = `braintree-amex-${txId}`;
        if (existingAmexIds.has(amexId)) return;

        const disbDate = cd.disbursement_date?.split("T")[0] || cd.settlement_date?.split("T")[0] || r.date?.split("T")[0];
        const settlementAmount = parseFloat(cd.settlement_amount || r.amount || 0);

        amexInserts.push({
            id: amexId,
            file_name: r.file_name || "braintree-amex-separated",
            source: "braintree-amex",
            date: disbDate || r.date,
            description: r.description || `AMEX - ${cd.customer_name || ""}`,
            amount: settlementAmount.toString(),
            currency: cd.settlement_currency || cd.currency || r.currency || "EUR",
            category: r.category || "Revenue",
            reconciled: false,
            customer_email: r.customer_email || cd.customer_email,
            customer_name: r.customer_name || cd.customer_name,
            external_id: txId,
            custom_data: {
                ...cd,
                id: amexId,
                date: disbDate || r.date,
                description: r.description,
                amount: settlementAmount,
                conciliado: false,
                destinationAccount: null,
                reconciliationType: null,
                _separated_from: "braintree-api-revenue",
                _separated_at: new Date().toISOString(),
            },
        });
    });

    log("📝", `Novas rows AMEX a inserir: ${amexInserts.length} (${existingAmexIds.size} já existem)`);

    if (DRY_RUN) {
        log("🔄", "[DRY RUN] Não inserindo dados.");
        return { total: amexRows.length, inserted: 0, skipped: existingAmexIds.size };
    }

    // Insert in batches
    let inserted = 0;
    for (let i = 0; i < amexInserts.length; i += 500) {
        const batch = amexInserts.slice(i, i + 500);
        const { error } = await supabase.from("csv_rows").upsert(batch, { onConflict: "id" });
        if (error) {
            log("❌", `Batch ${Math.floor(i / 500) + 1}: ${error.message}`);
        } else {
            inserted += batch.length;
            log("✅", `Batch ${Math.floor(i / 500) + 1}: ${batch.length} rows inseridas`);
        }
    }

    return { total: amexRows.length, inserted, skipped: existingAmexIds.size };
}

// ============================================================
// STEP 2: Braintree EUR Settlement Batch → Bankinter EUR
// ============================================================

async function step2_braintreeEurReconciliation() {
    section("PASSO 2 — Reconciliação Settlement Batch (Braintree EUR → Bankinter EUR)");

    // Strategy: assume-paid first (marks rows with disbursement_date <= today)
    log("📤", "Executando assume-paid strategy...");
    const assumeResult = await callAPI(`/api/reconciliation/braintree-eur?dryRun=${DRY_RUN ? "1" : "0"}&strategy=assume-paid`);

    if (assumeResult.success) {
        const d = assumeResult.data || {};
        log("✅", `Assume-paid: ${d.reconciled || 0} reconciliadas de ${d.total || 0} elegíveis`);
    } else {
        log("❌", `Assume-paid falhou: ${assumeResult.error}`);
    }

    // Strategy: settlement-batch (real matching with bank)
    log("📤", "Executando settlement-batch strategy...");
    const batchResult = await callAPI(`/api/reconciliation/braintree-eur?dryRun=${DRY_RUN ? "1" : "0"}&strategy=settlement-batch`);

    if (batchResult.success) {
        const d = batchResult.data || {};
        log("✅", `Settlement batch: ${d.reconciled || 0} batches reconciliados de ${d.total || 0}`);
        if (d.results) {
            const succeeded = (d.results || []).filter(r => r.success).length;
            const failed = (d.results || []).filter(r => !r.success).length;
            log("📊", `  Sucesso: ${succeeded} | Falhou: ${failed}`);
        }
    } else {
        log("❌", `Settlement batch falhou: ${batchResult.error}`);
    }

    return { assumeResult, batchResult };
}

// ============================================================
// STEP 3: Bank ↔ Disbursements (all banks)
// ============================================================

async function step3_bankDisbursementReconciliation() {
    section("PASSO 3 — Reconciliação Banco ↔ Disbursements (Todos os Bancos)");

    const results = {};
    const banks = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];

    for (const bank of banks) {
        log("📤", `Reconciliando ${bank}...`);
        const result = await callAPI("/api/reconcile/bank-disbursement", {
            bankSource: bank,
            dryRun: DRY_RUN,
        });

        if (result.success) {
            log("✅", `${bank}: ${result.matched || 0} matched de ${result.total || 0} | Valor: €${(result.summary?.totalValue || 0).toFixed(2)}`);
            if (result.summary?.bySource) {
                const bs = result.summary.bySource;
                log("📊", `  Braintree: ${bs.braintree || 0} | Stripe: ${bs.stripe || 0} | GoCardless: ${bs.gocardless || 0}`);
            }
        } else {
            log("⚠️", `${bank}: ${result.error || "sem dados"}`);
        }
        results[bank] = result;
    }

    return results;
}

// ============================================================
// STEP 4: Braintree ↔ Orders/Invoices
// ============================================================

async function step4_braintreeOrdersReconciliation() {
    section("PASSO 4 — Reconciliação Braintree ↔ Orders/Invoices");

    log("📤", "Executando reconciliação multi-strategy (order-id + email + amount-date)...");
    const result = await callAPI(`/api/reconciliation/braintree-orders?strategy=all&dryRun=${DRY_RUN ? "1" : "0"}`);

    if (result.success) {
        const d = result.data || result;
        log("✅", `Total matches: ${d.totalMatches || d.matched || 0}`);
        if (d.byStrategy) {
            Object.entries(d.byStrategy).forEach(([strategy, count]) => {
                log("📊", `  ${strategy}: ${count} matches`);
            });
        }
    } else {
        log("⚠️", `Braintree-Orders: ${result.error || "sem dados"}`);
    }

    return result;
}

// ============================================================
// STEP 5: AR Invoices ↔ Payments
// ============================================================

async function step5_arInvoicesReconciliation() {
    section("PASSO 5 — Reconciliação AR Invoices ↔ Pagamentos");

    log("📤", "Executando reconciliação automática AR Invoices...");
    const result = await callAPI("/api/reconcile/auto", {
        dryRun: DRY_RUN,
    });

    if (result.success) {
        const d = result.data || result;
        log("✅", `Matches: ${d.matched || d.totalMatches || 0}`);
        if (d.bySource) {
            Object.entries(d.bySource).forEach(([src, count]) => {
                log("📊", `  ${src}: ${count} matches`);
            });
        }
    } else {
        log("⚠️", `AR Invoices: ${result.error || "sem dados"}`);
    }

    return result;
}

// ============================================================
// STEP 6: Final Report
// ============================================================

async function step6_finalReport() {
    section("RELATÓRIO FINAL");

    // Count reconciled vs total by key sources
    const sources = [
        "braintree-api-revenue",
        "braintree-amex",
        "bankinter-eur",
        "bankinter-usd",
    ];

    for (const src of sources) {
        const { count: total } = await supabase
            .from("csv_rows").select("id", { count: "exact", head: true }).eq("source", src);
        const { count: reconciled } = await supabase
            .from("csv_rows").select("id", { count: "exact", head: true }).eq("source", src).eq("reconciled", true);
        const pct = total > 0 ? ((reconciled / total) * 100).toFixed(1) : "0";
        log("📊", `${src}: ${reconciled}/${total} reconciliadas (${pct}%)`);
    }

    // Braintree by currency
    const btAll = await fetchAll("braintree-api-revenue");
    const eurRows = btAll.filter(r => {
        const cd = r.custom_data || {};
        return cd.currency === "EUR" || (cd.merchant_account_id || "").toLowerCase().includes("eur");
    });
    const usdRows = btAll.filter(r => {
        const cd = r.custom_data || {};
        return cd.currency === "USD" || (cd.merchant_account_id || "").toLowerCase().includes("usd");
    });

    log("💶", `EUR: ${eurRows.filter(r => r.reconciled).length}/${eurRows.length} reconciliadas`);
    log("💵", `USD: ${usdRows.filter(r => r.reconciled).length}/${usdRows.length} reconciliadas`);

    // AMEX
    const amexInBt = btAll.filter(r => {
        const ct = (r.custom_data?.card_type || "").toLowerCase();
        return ct.includes("amex") || ct.includes("american express");
    });
    log("💳", `AMEX (in braintree-api-revenue): ${amexInBt.filter(r => r.reconciled).length}/${amexInBt.length} reconciliadas`);

    // AR Invoices
    const { count: arTotal } = await supabase.from("ar_invoices").select("id", { count: "exact", head: true });
    const { count: arRec } = await supabase.from("ar_invoices").select("id", { count: "exact", head: true }).eq("reconciled", true);
    log("📄", `AR Invoices: ${arRec || 0}/${arTotal || 0} reconciliadas`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log("═".repeat(60));
    console.log("  🚀 CONCILIAÇÃO COMPLETA — ORQUESTRADOR");
    console.log(`  Modo: ${DRY_RUN ? "DRY RUN (sem alterações)" : "PRODUÇÃO (alterações reais)"}`);
    console.log(`  Data: ${new Date().toISOString()}`);
    console.log("═".repeat(60));

    const results = {};

    // Step 1: Separate AMEX
    results.amex = await step1_separateAMEX();

    // Steps 2-5 require the dev server running
    // Check if server is available
    try {
        const healthCheck = await fetch(`${BASE_URL}/api/csv-rows?source=braintree-api-revenue&limit=1`);
        if (!healthCheck.ok) throw new Error(`HTTP ${healthCheck.status}`);
        log("✅", `Servidor Next.js disponível em ${BASE_URL}`);
    } catch (err) {
        log("⚠️", `Servidor Next.js não disponível em ${BASE_URL}`);
        log("💡", "Passos 2-5 usam APIs internas. Inicie o servidor com 'npm run dev' e re-execute.");
        log("💡", "O Passo 1 (AMEX) já foi executado via Supabase direto.");

        // Still run the report from direct DB queries
        await step6_finalReport();
        return;
    }

    // Step 2: Braintree EUR settlement batch reconciliation
    results.eurReconcile = await step2_braintreeEurReconciliation();

    // Step 3: Bank disbursement reconciliation (all banks)
    results.bankDisb = await step3_bankDisbursementReconciliation();

    // Step 4: Braintree ↔ Orders/Invoices 
    results.orders = await step4_braintreeOrdersReconciliation();

    // Step 5: AR Invoices ↔ Payments
    results.arInvoices = await step5_arInvoicesReconciliation();

    // Step 6: Final report
    await step6_finalReport();

    section("CONCLUÍDO");
    log("✅", "Orquestração completa. Verifique os resultados nas páginas de relatórios.");
}

main().catch((err) => {
    console.error("❌ Erro fatal:", err);
    process.exit(1);
});
