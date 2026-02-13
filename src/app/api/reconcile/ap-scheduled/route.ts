/**
 * API Endpoint: Reconciliação Automática de Pagamentos Agendados/Feitos
 *
 * POST /api/reconcile/ap-scheduled
 *
 * Busca AP invoices que:
 *   A) Têm payment_status='paid' mas is_reconciled=false (pagas, não reconciliadas)
 *   B) Têm schedule_date nos últimos 7 dias e is_reconciled=false
 *
 * Para cada uma, procura transação de débito no banco correspondente:
 *   - Amount exato (±0.01)
 *   - Date ±5 dias úteis (cobrindo sexta→segunda)
 *   - Banco correspondente ao bank_account_code
 *
 * Se match ÚNICO → reconcilia automaticamente
 * Se múltiplos → marca needs_review no log (não reconcilia)
 *
 * Body: { dryRun?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/** Days diff */
function daysDiff(a: string, b: string): number {
    return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/** Bank source from bank_account_code */
function bankSourcesFor(code: string | null): string[] {
    const c = (code || "").toLowerCase();
    if (c.includes("4605") || c.includes("eur")) return ["bankinter-eur"];
    if (c.includes("usd") && c.includes("bankinter")) return ["bankinter-usd"];
    if (c.includes("sabadell") || c.includes("0081")) return ["sabadell"];
    if (c.includes("chase") || (c.includes("usd") && !c.includes("bankinter"))) return ["chase-usd"];
    return ["bankinter-eur", "sabadell"];
}

/** Paginated fetch */
async function fetchAll(table: string, filter: (q: any) => any): Promise<any[]> {
    let all: any[] = [];
    let offset = 0;
    while (true) {
        let q = supabaseAdmin.from(table).select("*");
        q = filter(q);
        q = q.range(offset, offset + 999);
        const { data } = await q;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        offset += 1000;
    }
    return all;
}

interface ScheduledMatch {
    invoice_id: number;
    invoice_number: string | null;
    provider_code: string;
    invoice_amount: number;
    bank_tx_id: string;
    bank_amount: number;
    bank_date: string;
    match_reason: string;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false;

        console.log(`[ap-scheduled] Starting scheduled payment reconciliation | dryRun=${dryRun}`);

        // 1. Fetch invoices: (A) paid but not reconciled + (B) scheduled in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dateLimit = sevenDaysAgo.toISOString().split("T")[0];

        // A: paid + not reconciled
        const paidInvoices = await fetchAll("invoices", (q: any) =>
            q
                .eq("invoice_type", "INCURRED")
                .eq("payment_status", "paid")
                .or("is_reconciled.is.null,is_reconciled.eq.false")
        );

        // B: recent schedule_date + not reconciled (exclude already fetched)
        const scheduledInvoices = await fetchAll("invoices", (q: any) =>
            q
                .eq("invoice_type", "INCURRED")
                .or("is_reconciled.is.null,is_reconciled.eq.false")
                .gte("schedule_date", dateLimit)
                .neq("payment_status", "paid")
        );

        const allInvoices = [...paidInvoices, ...scheduledInvoices];
        // Deduplicate by id
        const invoiceMap = new Map<number, any>();
        allInvoices.forEach(inv => invoiceMap.set(inv.id, inv));
        const invoices = Array.from(invoiceMap.values());

        console.log(`[ap-scheduled] ${invoices.length} invoices (${paidInvoices.length} paid + ${scheduledInvoices.length} scheduled)`);

        if (invoices.length === 0) {
            return NextResponse.json({
                success: true, dryRun,
                summary: { invoices: 0, matched: 0, needsReview: 0 },
            });
        }

        // 2. Fetch debit bank transactions (last 30 days, not reconciled)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const bankMinDate = thirtyDaysAgo.toISOString().split("T")[0];

        const BANK_SOURCES = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];
        const bankTxs = await fetchAll("csv_rows", (q: any) =>
            q
                .in("source", BANK_SOURCES)
                .lt("amount", 0)
                .eq("reconciled", false)
                .gte("date", bankMinDate)
        );

        console.log(`[ap-scheduled] ${bankTxs.length} unreconciled bank debits`);

        // Index bank txs by rounded amount
        const bankByAmount = new Map<number, any[]>();
        for (const tx of bankTxs) {
            const amt = Math.round(Math.abs(tx.amount));
            if (!bankByAmount.has(amt)) bankByAmount.set(amt, []);
            bankByAmount.get(amt)!.push(tx);
        }

        // 3. Match each invoice
        const matches: ScheduledMatch[] = [];
        const needsReview: { invoice_id: number; reason: string; candidateCount: number }[] = [];
        const matchedInvoiceIds = new Set<number>();
        const matchedBankIds = new Set<string>();

        for (const inv of invoices) {
            if (matchedInvoiceIds.has(inv.id)) continue;

            const invAmount = Math.abs(parseFloat(inv.paid_amount) || parseFloat(inv.invoice_amount) || 0);
            if (invAmount < 0.01) continue;

            // Reference date: payment_date (if paid), else schedule_date
            const refDate = inv.payment_date || inv.schedule_date;
            if (!refDate) continue;

            // Get candidates by amount neighborhood
            const amtKey = Math.round(invAmount);
            const candidates: any[] = [];
            for (const k of [amtKey - 1, amtKey, amtKey + 1]) {
                const list = bankByAmount.get(k);
                if (list) candidates.push(...list);
            }

            // Filter to relevant bank + unmatched + exact amount ±0.01 + date ±5 business days (~7 calendar)
            const relevantSources = new Set(bankSourcesFor(inv.bank_account_code));
            const exactMatches = candidates.filter(tx => {
                if (matchedBankIds.has(tx.id)) return false;
                if (!relevantSources.has(tx.source)) return false;
                const txAmt = Math.abs(tx.amount);
                if (Math.abs(txAmt - invAmount) > 0.01) return false;
                if (daysDiff(refDate, tx.date) > 7) return false;
                return true;
            });

            if (exactMatches.length === 1) {
                // Unique match → auto-reconcile
                const tx = exactMatches[0];
                matches.push({
                    invoice_id: inv.id,
                    invoice_number: inv.invoice_number,
                    provider_code: inv.provider_code || "",
                    invoice_amount: invAmount,
                    bank_tx_id: tx.id,
                    bank_amount: tx.amount,
                    bank_date: tx.date,
                    match_reason: inv.payment_status === "paid" ? "paid_exact_match" : "scheduled_exact_match",
                });
                matchedInvoiceIds.add(inv.id);
                matchedBankIds.add(tx.id);
            } else if (exactMatches.length > 1) {
                // Multiple matches → needs review
                needsReview.push({
                    invoice_id: inv.id,
                    reason: `${exactMatches.length} bank transactions with same amount ±0.01 in date range`,
                    candidateCount: exactMatches.length,
                });
            }
        }

        console.log(`[ap-scheduled] Matched: ${matches.length} | Needs review: ${needsReview.length}`);

        // 4. Apply
        let applied = 0;
        const errors: string[] = [];

        if (!dryRun && matches.length > 0) {
            for (const m of matches) {
                try {
                    const now = new Date().toISOString();

                    // Update invoice
                    const { error: invErr } = await supabaseAdmin
                        .from("invoices")
                        .update({
                            is_reconciled: true,
                            reconciled_transaction_id: m.bank_tx_id,
                            reconciled_at: now,
                            reconciled_amount: m.invoice_amount,
                        })
                        .eq("id", m.invoice_id);

                    if (invErr) {
                        errors.push(`inv ${m.invoice_id}: ${invErr.message}`);
                        continue;
                    }

                    // Update bank transaction
                    await supabaseAdmin
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: {
                                reconciliationType: "automatic",
                                reconciled_at: now,
                                matched_invoice_ids: [m.invoice_id],
                                matched_invoice_numbers: m.invoice_number || "",
                                matched_invoice_total: m.invoice_amount,
                                matched_provider: m.provider_code,
                                match_type: m.match_reason,
                                api: "ap-scheduled",
                            },
                        })
                        .eq("id", m.bank_tx_id);

                    // Log history
                    await supabaseAdmin.from("invoice_history").insert({
                        invoice_id: m.invoice_id,
                        change_type: "reconciled",
                        field_name: "is_reconciled",
                        old_value: "false",
                        new_value: "true",
                        changed_by: "BOTella",
                        metadata: {
                            method: "automatic",
                            api: "ap-scheduled",
                            match_reason: m.match_reason,
                            bank_tx_id: m.bank_tx_id,
                            bank_amount: m.bank_amount,
                            bank_date: m.bank_date,
                            reconciled_at: now,
                        },
                    }).then(() => { }).catch(() => { });

                    applied++;
                } catch (err: any) {
                    errors.push(`inv ${m.invoice_id}: ${err.message}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                invoicesChecked: invoices.length,
                paidNotReconciled: paidInvoices.length,
                scheduledRecent: scheduledInvoices.length,
                matched: matches.length,
                needsReview: needsReview.length,
                applied: dryRun ? 0 : applied,
                totalValue: Math.round(matches.reduce((s, m) => s + m.invoice_amount, 0) * 100) / 100,
                errors: errors.slice(0, 10),
            },
            matches: matches.slice(0, 50),
            needsReview: needsReview.slice(0, 20),
        });
    } catch (error: any) {
        console.error("[ap-scheduled] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
