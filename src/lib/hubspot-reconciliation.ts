/**
 * HubSpot Reconciliation Module
 * Reconcilia deals do HubSpot com transações de pagamento (Braintree, Stripe, GoCardless)
 * 
 * Estratégias de matching:
 * 1. Por Order ID (preciso) - para deals e-commerce
 * 2. Por Email + Amount + Date (aproximado) - para deals manuais
 */

import { supabase } from "./supabase";

// Tipos
export interface HubSpotDeal {
    id: string;
    description: string;
    amount: number;
    date: string;
    customer_email: string | null;
    customer_name: string | null;
    custom_data: {
        order_code?: string;
        product_name?: string;
        deal_stage?: string;
        paid_status?: string;
        [key: string]: unknown;
    };
    reconciled?: boolean;
}

export interface PaymentTransaction {
    id: string;
    source: string;
    description: string;
    amount: number;
    date: string;
    customer_email: string | null;
    customer_name: string | null;
    custom_data: {
        transaction_id?: string;
        order_id?: string;
        customer_email?: string;
        customer_name?: string;
        billing_name?: string;
        company_name?: string;
        [key: string]: unknown;
    };
    reconciled?: boolean;
}

export interface ReconciliationMatch {
    hubspot_id: string;
    payment_id: string;
    payment_source: string;
    match_type: "order_id" | "email_amount_date" | "name_amount_date";
    confidence: "high" | "medium" | "low";
    hubspot_amount: number;
    payment_amount: number;
    amount_diff: number;
    date_diff_days: number;
}

export interface ReconciliationResult {
    total_hubspot_deals: number;
    deals_with_order_id: number;
    deals_without_order_id: number;
    matches_by_order_id: number;
    matches_by_email: number;
    matches_by_name: number;
    unmatched_deals: number;
    matches: ReconciliationMatch[];
    unmatched: HubSpotDeal[];
}

// Constantes
const DATE_TOLERANCE_DAYS = 3;
const AMOUNT_TOLERANCE_PERCENT = 0.01; // 1% tolerance

// Sources de pagamento suportadas
const PAYMENT_SOURCES = [
    "braintree-api-revenue",
    "braintree-eur",
    "braintree-usd",
    "stripe-eur",
    "stripe-usd",
    "gocardless",
    "gocardless-eur",
];

/**
 * Valida se é um Order ID válido (7 caracteres hexadecimais)
 */
export function isValidOrderId(orderId: string | undefined | null): boolean {
    if (!orderId) return false;
    return /^[a-f0-9]{7}$/i.test(orderId);
}

/**
 * Calcula diferença em dias entre duas datas
 */
function daysDiff(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs(Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Normaliza email para comparação
 */
function normalizeEmail(email: string | null | undefined): string {
    if (!email) return "";
    return email.toLowerCase().trim();
}

/**
 * Extrai email de uma transação de pagamento
 */
function getPaymentEmail(tx: PaymentTransaction): string {
    return normalizeEmail(
        tx.customer_email ||
        tx.custom_data?.customer_email ||
        tx.custom_data?.email as string
    );
}

/**
 * Normaliza nome para comparação (remove acentos, lowercase, trim)
 */
function normalizeName(name: string | null | undefined): string {
    if (!name) return "";
    return name
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z\s]/g, "") // Remove caracteres especiais
        .replace(/\s+/g, " "); // Normaliza espaços
}

/**
 * Extrai nomes de uma transação de pagamento para comparação
 */
function getPaymentNames(tx: PaymentTransaction): string[] {
    const names: string[] = [];

    if (tx.customer_name) names.push(normalizeName(tx.customer_name));
    if (tx.custom_data?.customer_name) names.push(normalizeName(tx.custom_data.customer_name as string));
    if (tx.custom_data?.billing_name) names.push(normalizeName(tx.custom_data.billing_name as string));
    if (tx.custom_data?.company_name) names.push(normalizeName(tx.custom_data.company_name as string));

    // Também extrai do description (pode ter nome do cliente)
    if (tx.description) {
        const descParts = tx.description.split(" - ");
        if (descParts.length > 0) {
            names.push(normalizeName(descParts[0]));
        }
    }

    return names.filter(n => n.length > 2); // Ignora nomes muito curtos
}

/**
 * Verifica se dois nomes são similares (match parcial)
 */
function namesMatch(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;

    const n1 = normalizeName(name1);
    const n2 = normalizeName(name2);

    // Match exato
    if (n1 === n2) return true;

    // Um contém o outro
    if (n1.includes(n2) || n2.includes(n1)) return true;

    // Match por partes do nome (primeiro e último nome)
    const parts1 = n1.split(" ").filter(p => p.length > 2);
    const parts2 = n2.split(" ").filter(p => p.length > 2);

    // Se pelo menos 2 partes coincidem
    const matches = parts1.filter(p1 => parts2.some(p2 => p1 === p2 || p1.includes(p2) || p2.includes(p1)));
    return matches.length >= 2 || (matches.length === 1 && parts1.length === 1 && parts2.length === 1);
}

/**
 * Busca deals do HubSpot não reconciliados
 */
export async function fetchUnreconciledHubSpotDeals(): Promise<HubSpotDeal[]> {
    if (!supabase) {
        throw new Error("Supabase client não configurado");
    }

    const { data, error } = await supabase
        .from("csv_rows")
        .select("id, description, amount, date, customer_email, customer_name, custom_data, reconciled")
        .eq("source", "hubspot")
        .or("reconciled.is.null,reconciled.eq.false");

    if (error) {
        console.error("❌ Erro ao buscar deals HubSpot:", error);
        throw error;
    }

    return (data || []) as HubSpotDeal[];
}

/**
 * Busca transações de pagamento não reconciliadas
 */
export async function fetchPaymentTransactions(): Promise<PaymentTransaction[]> {
    if (!supabase) {
        throw new Error("Supabase client não configurado");
    }

    const { data, error } = await supabase
        .from("csv_rows")
        .select("id, source, description, amount, date, customer_email, custom_data, reconciled")
        .in("source", PAYMENT_SOURCES)
        .or("reconciled.is.null,reconciled.eq.false");

    if (error) {
        console.error("❌ Erro ao buscar transações de pagamento:", error);
        throw error;
    }

    return (data || []) as PaymentTransaction[];
}

/**
 * Reconcilia deals do HubSpot com transações de pagamento
 */
export async function reconcileHubSpotDeals(): Promise<ReconciliationResult> {
    console.log("🔄 Iniciando reconciliação HubSpot...");

    // Buscar dados
    const hubspotDeals = await fetchUnreconciledHubSpotDeals();
    const paymentTransactions = await fetchPaymentTransactions();

    console.log(`📊 Deals HubSpot: ${hubspotDeals.length}`);
    console.log(`💳 Transações de pagamento: ${paymentTransactions.length}`);

    // Separar deals por tipo
    const dealsWithOrderId = hubspotDeals.filter(d => isValidOrderId(d.custom_data?.order_code));
    const dealsWithoutOrderId = hubspotDeals.filter(d => !isValidOrderId(d.custom_data?.order_code));

    console.log(`  ✅ Com Order ID: ${dealsWithOrderId.length}`);
    console.log(`  ⚠️  Sem Order ID: ${dealsWithoutOrderId.length}`);

    const matches: ReconciliationMatch[] = [];
    const matchedHubSpotIds = new Set<string>();
    const matchedPaymentIds = new Set<string>();

    // 1. MATCH POR ORDER ID (alta precisão)
    console.log("\n🎯 Fase 1: Match por Order ID...");

    for (const deal of dealsWithOrderId) {
        const orderId = deal.custom_data?.order_code?.toLowerCase();

        const matchingTx = paymentTransactions.find(tx => {
            if (matchedPaymentIds.has(tx.id)) return false;

            const txOrderId = (
                tx.custom_data?.order_id ||
                tx.custom_data?.orderId ||
                tx.custom_data?.order_code
            )?.toString().toLowerCase();

            return txOrderId === orderId;
        });

        if (matchingTx) {
            matches.push({
                hubspot_id: deal.id,
                payment_id: matchingTx.id,
                payment_source: matchingTx.source,
                match_type: "order_id",
                confidence: "high",
                hubspot_amount: deal.amount,
                payment_amount: matchingTx.amount,
                amount_diff: Math.abs(deal.amount - matchingTx.amount),
                date_diff_days: daysDiff(deal.date, matchingTx.date),
            });

            matchedHubSpotIds.add(deal.id);
            matchedPaymentIds.add(matchingTx.id);
        }
    }

    console.log(`  → Matches por Order ID: ${matches.filter(m => m.match_type === "order_id").length}`);

    // 2. MATCH POR EMAIL + AMOUNT + DATE (precisão média)
    console.log("\n📧 Fase 2: Match por Email + Valor + Data...");

    for (const deal of dealsWithoutOrderId) {
        if (matchedHubSpotIds.has(deal.id)) continue;

        const dealEmail = normalizeEmail(deal.customer_email);
        if (!dealEmail) continue;

        // Procurar transação com mesmo email, valor similar e data próxima
        const matchingTx = paymentTransactions.find(tx => {
            if (matchedPaymentIds.has(tx.id)) return false;

            const txEmail = getPaymentEmail(tx);
            if (txEmail !== dealEmail) return false;

            // Verificar valor (tolerância de 1%)
            const amountDiff = Math.abs(deal.amount - tx.amount);
            const amountTolerance = deal.amount * AMOUNT_TOLERANCE_PERCENT;
            if (amountDiff > amountTolerance && amountDiff > 1) return false;

            // Verificar data (tolerância de 3 dias)
            const dateDiff = daysDiff(deal.date, tx.date);
            if (dateDiff > DATE_TOLERANCE_DAYS) return false;

            return true;
        });

        if (matchingTx) {
            const dateDiff = daysDiff(deal.date, matchingTx.date);

            matches.push({
                hubspot_id: deal.id,
                payment_id: matchingTx.id,
                payment_source: matchingTx.source,
                match_type: "email_amount_date",
                confidence: dateDiff <= 1 ? "medium" : "low",
                hubspot_amount: deal.amount,
                payment_amount: matchingTx.amount,
                amount_diff: Math.abs(deal.amount - matchingTx.amount),
                date_diff_days: dateDiff,
            });

            matchedHubSpotIds.add(deal.id);
            matchedPaymentIds.add(matchingTx.id);
        }
    }

    console.log(`  → Matches por Email: ${matches.filter(m => m.match_type === "email_amount_date").length}`);

    // 3. MATCH POR NOME + AMOUNT + DATE (precisão baixa - fallback)
    console.log("\n👤 Fase 3: Match por Nome + Valor + Data...");

    for (const deal of hubspotDeals) {
        if (matchedHubSpotIds.has(deal.id)) continue;

        const dealName = normalizeName(deal.customer_name);
        if (!dealName || dealName.length < 3) continue;

        // Procurar transação com nome similar, valor similar e data próxima
        const matchingTx = paymentTransactions.find(tx => {
            if (matchedPaymentIds.has(tx.id)) return false;

            // Verificar se algum nome da transação corresponde
            const txNames = getPaymentNames(tx);
            const hasNameMatch = txNames.some(txName => namesMatch(dealName, txName));
            if (!hasNameMatch) return false;

            // Verificar valor (tolerância de 1%)
            const amountDiff = Math.abs(deal.amount - tx.amount);
            const amountTolerance = deal.amount * AMOUNT_TOLERANCE_PERCENT;
            if (amountDiff > amountTolerance && amountDiff > 1) return false;

            // Verificar data (tolerância de 3 dias)
            const dateDiff = daysDiff(deal.date, tx.date);
            if (dateDiff > DATE_TOLERANCE_DAYS) return false;

            return true;
        });

        if (matchingTx) {
            const dateDiff = daysDiff(deal.date, matchingTx.date);

            matches.push({
                hubspot_id: deal.id,
                payment_id: matchingTx.id,
                payment_source: matchingTx.source,
                match_type: "name_amount_date",
                confidence: "low", // Match por nome sempre tem baixa confiança
                hubspot_amount: deal.amount,
                payment_amount: matchingTx.amount,
                amount_diff: Math.abs(deal.amount - matchingTx.amount),
                date_diff_days: dateDiff,
            });

            matchedHubSpotIds.add(deal.id);
            matchedPaymentIds.add(matchingTx.id);
        }
    }

    console.log(`  → Matches por Nome: ${matches.filter(m => m.match_type === "name_amount_date").length}`);

    // Deals não reconciliados
    const unmatchedDeals = hubspotDeals.filter(d => !matchedHubSpotIds.has(d.id));

    const result: ReconciliationResult = {
        total_hubspot_deals: hubspotDeals.length,
        deals_with_order_id: dealsWithOrderId.length,
        deals_without_order_id: dealsWithoutOrderId.length,
        matches_by_order_id: matches.filter(m => m.match_type === "order_id").length,
        matches_by_email: matches.filter(m => m.match_type === "email_amount_date").length,
        matches_by_name: matches.filter(m => m.match_type === "name_amount_date").length,
        unmatched_deals: unmatchedDeals.length,
        matches,
        unmatched: unmatchedDeals,
    };

    console.log("\n📊 RESULTADO FINAL:");
    console.log(`  ✅ Matches por Order ID: ${result.matches_by_order_id}`);
    console.log(`  📧 Matches por Email: ${result.matches_by_email}`);
    console.log(`  👤 Matches por Nome: ${result.matches_by_name}`);
    console.log(`  ❌ Não reconciliados: ${result.unmatched_deals}`);

    return result;
}

/**
 * Aplica os matches no banco de dados (marca como reconciliado)
 */
export async function applyReconciliationMatches(
    matches: ReconciliationMatch[],
    dryRun: boolean = true
): Promise<{ success: number; errors: number }> {
    if (!supabase) {
        throw new Error("Supabase client não configurado");
    }

    if (dryRun) {
        console.log("🔍 DRY RUN - Nenhuma alteração será feita");
        return { success: matches.length, errors: 0 };
    }

    let success = 0;
    let errors = 0;

    for (const match of matches) {
        try {
            // Atualizar deal do HubSpot
            const { error: hubspotError } = await supabase
                .from("csv_rows")
                .update({
                    reconciled: true,
                })
                .eq("id", match.hubspot_id);

            if (hubspotError) throw hubspotError;

            // Atualizar transação de pagamento
            const { error: paymentError } = await supabase
                .from("csv_rows")
                .update({
                    reconciled: true,
                })
                .eq("id", match.payment_id);

            if (paymentError) throw paymentError;

            success++;
        } catch (error) {
            console.error(`❌ Erro ao aplicar match ${match.hubspot_id} <-> ${match.payment_id}:`, error);
            errors++;
        }
    }

    console.log(`\n✅ Aplicados: ${success} | ❌ Erros: ${errors}`);
    return { success, errors };
}

/**
 * Gera relatório de deals não reconciliados
 */
export function generateUnmatchedReport(unmatched: HubSpotDeal[]): string {
    const categories: Record<string, HubSpotDeal[]> = {
        "Provider (Subscriptions)": [],
        "Cursos": [],
        "Mastership": [],
        "DSD Clinic": [],
        "Reativações": [],
        "Outros": [],
    };

    for (const deal of unmatched) {
        const desc = deal.description || "";
        if (desc.includes("Provider")) {
            categories["Provider (Subscriptions)"].push(deal);
        } else if (desc.includes("CAM") || desc.includes("TA Courses")) {
            categories["Cursos"].push(deal);
        } else if (desc.includes("Mastership")) {
            categories["Mastership"].push(deal);
        } else if (desc.includes("DSD Clinic")) {
            categories["DSD Clinic"].push(deal);
        } else if (desc.includes("reactivation")) {
            categories["Reativações"].push(deal);
        } else {
            categories["Outros"].push(deal);
        }
    }

    let report = `# Relatório de Deals Não Reconciliados\n\n`;
    report += `Total: ${unmatched.length} deals\n\n`;

    for (const [category, deals] of Object.entries(categories)) {
        if (deals.length === 0) continue;

        report += `## ${category} (${deals.length})\n\n`;
        report += `| Deal | Valor | Email | Data |\n`;
        report += `|------|-------|-------|------|\n`;

        for (const deal of deals.slice(0, 10)) {
            report += `| ${deal.description?.substring(0, 40) || "N/A"} | €${deal.amount} | ${deal.customer_email || "N/A"} | ${deal.date} |\n`;
        }

        if (deals.length > 10) {
            report += `| ... e mais ${deals.length - 10} deals | | | |\n`;
        }

        report += "\n";
    }

    return report;
}
