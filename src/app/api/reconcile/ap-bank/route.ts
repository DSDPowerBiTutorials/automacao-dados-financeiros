/**
 * API Endpoint: Reconciliação Automática AP Invoices ↔ Bank Transactions
 *
 * POST /api/reconcile/ap-bank
 *
 * Cruza invoices de contas a pagar (tabela `invoices`) com transações 
 * de débito bancário (tabela `csv_rows`, amount < 0) usando 5 estratégias:
 *
 *   S1: provider fuzzy ≥70% + amount exato ±0.01 + date ±3d  (conf 0.95)
 *   S2: provider fuzzy ≥60% + amount exato ±0.01 + date ±5d  (conf 0.85)
 *   S3: invoice_number na description do banco + amount ±0.01 (conf 0.90)
 *   S4: provider fuzzy ≥60% + amount ±2% + date ±7d          (conf 0.70)
 *   S5: amount exato ±0.01 + date ±3d (sem provider)         (conf 0.55)
 *
 * Suporta múltiplas invoices → 1 transação bancária (soma).
 * Regista cada reconciliação no `invoice_history`.
 *
 * Body: { dryRun?: boolean, minDate?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ─── helpers ────────────────────────────────────────────────

/** Normalize text for fuzzy comparison (lowercase, strip accents/symbols) */
function norm(s: string): string {
    return s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

/** Bigram-based string similarity (0-1) */
function stringSimilarity(s1: string, s2: string): number {
    const a = norm(s1);
    const b = norm(s2);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.85;
    const bg = (s: string) => {
        const m = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i++) {
            const bi = s.substring(i, i + 2);
            m.set(bi, (m.get(bi) || 0) + 1);
        }
        return m;
    };
    const biA = bg(a);
    const biB = bg(b);
    let matches = 0;
    biB.forEach((cnt, bi) => { matches += Math.min(cnt, biA.get(bi) || 0); });
    const total = (a.length - 1) + (b.length - 1);
    return total > 0 ? (2 * matches) / total : 0;
}

/** Extract supplier name after "/" in Bankinter descriptions */
function extractSupplier(desc: string): string | null {
    const idx = desc.indexOf("/");
    if (idx >= 0 && idx < desc.length - 2) {
        const after = desc.substring(idx + 1).trim();
        if (after.length >= 3 && !/^\d+$/.test(after)) return after;
    }
    return null;
}

/** Days difference between two ISO date strings */
function daysDiff(a: string, b: string): number {
    return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/** Paginated fetch from supabase */
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

// Bank source mapping from bank_account_code
function bankSourcesFor(bankAccountCode: string | null): string[] {
    const code = (bankAccountCode || "").toLowerCase();
    if (code.includes("4605") || code.includes("eur")) return ["bankinter-eur"];
    if (code.includes("usd") && code.includes("bankinter")) return ["bankinter-usd"];
    if (code.includes("sabadell") || code.includes("0081")) return ["sabadell"];
    if (code.includes("chase") || (code.includes("usd") && !code.includes("bankinter"))) return ["chase-usd"];
    // Default: all EUR banks
    return ["bankinter-eur", "sabadell"];
}

// ─── types ──────────────────────────────────────────────────

interface APMatch {
    invoice_id: number;
    invoice_number: string | null;
    provider_code: string;
    invoice_amount: number;
    bank_tx_id: string;
    bank_amount: number;
    bank_date: string;
    match_type: string;
    confidence: number;
}

// ─── main handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const dryRun = body.dryRun !== false; // default true
        const minDate = body.minDate || "2025-01-01";

        console.log(`[ap-bank] Starting AP ↔ Bank reconciliation | dryRun=${dryRun} | minDate=${minDate}`);

        // 1. Fetch all unreconciled AP invoices (INCURRED only)
        const invoices = await fetchAll("invoices", (q: any) =>
            q
                .eq("invoice_type", "INCURRED")
                .or("is_reconciled.is.null,is_reconciled.eq.false")
                .gte("invoice_date", minDate)
        );
        console.log(`[ap-bank] ${invoices.length} unreconciled AP invoices`);

        if (invoices.length === 0) {
            return NextResponse.json({
                success: true, dryRun,
                summary: { invoices: 0, bankTx: 0, matched: 0, byStrategy: {} },
            });
        }

        // 2. Fetch debit bank transactions (amount < 0)
        const BANK_SOURCES = ["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"];
        const bankTxs = await fetchAll("csv_rows", (q: any) =>
            q
                .in("source", BANK_SOURCES)
                .lt("amount", 0)
                .eq("reconciled", false)
                .gte("date", minDate)
        );
        console.log(`[ap-bank] ${bankTxs.length} unreconciled bank debits`);

        // 3. Build bank indexes
        // Key: normalized description → tx list
        const bankByAmount = new Map<number, any[]>();
        for (const tx of bankTxs) {
            const amt = Math.round(Math.abs(tx.amount));
            if (!bankByAmount.has(amt)) bankByAmount.set(amt, []);
            bankByAmount.get(amt)!.push(tx);
        }

        // 4. Run matching
        const matches: APMatch[] = [];
        const matchedInvoiceIds = new Set<number>();
        const matchedBankIds = new Set<string>();
        const stats: Record<string, number> = {};

        function recordMatch(m: APMatch) {
            matches.push(m);
            matchedInvoiceIds.add(m.invoice_id);
            matchedBankIds.add(m.bank_tx_id);
            stats[m.match_type] = (stats[m.match_type] || 0) + 1;
        }

        for (const inv of invoices) {
            if (matchedInvoiceIds.has(inv.id)) continue;

            const invAmount = Math.abs(parseFloat(inv.paid_amount) || parseFloat(inv.invoice_amount) || 0);
            if (invAmount < 0.01) continue;

            const invDate = inv.schedule_date || inv.payment_date || inv.due_date || inv.invoice_date;
            if (!invDate) continue;

            const provider = inv.provider_code || "";
            const invNumber = inv.invoice_number || "";

            // Get candidate bank txs by amount neighborhood (±1)
            const amtKey = Math.round(invAmount);
            const candidates: any[] = [];
            for (const k of [amtKey - 1, amtKey, amtKey + 1]) {
                const list = bankByAmount.get(k);
                if (list) candidates.push(...list);
            }

            // Filter to unmatched candidates from relevant bank
            const relevantSources = new Set(bankSourcesFor(inv.bank_account_code));
            const validCandidates = candidates.filter(
                (tx) => !matchedBankIds.has(tx.id) && relevantSources.has(tx.source)
            );

            if (validCandidates.length === 0) continue;

            let matched = false;

            // S1: provider fuzzy ≥70% + exact amount ±0.01 + date ±3d (conf 0.95)
            if (!matched) {
                for (const tx of validCandidates) {
                    const txAmt = Math.abs(tx.amount);
                    if (Math.abs(txAmt - invAmount) > 0.01) continue;
                    if (daysDiff(invDate, tx.date) > 3) continue;

                    const extracted = extractSupplier(tx.description || "");
                    const bestSim = Math.max(
                        stringSimilarity(provider, tx.description || ""),
                        extracted ? stringSimilarity(provider, extracted) : 0
                    );

                    if (bestSim >= 0.70) {
                        recordMatch({
                            invoice_id: inv.id,
                            invoice_number: invNumber,
                            provider_code: provider,
                            invoice_amount: invAmount,
                            bank_tx_id: tx.id,
                            bank_amount: tx.amount,
                            bank_date: tx.date,
                            match_type: "provider+exact+3d",
                            confidence: 0.95,
                        });
                        matched = true;
                        break;
                    }
                }
            }

            // S2: provider fuzzy ≥60% + exact amount ±0.01 + date ±5d (conf 0.85)
            if (!matched) {
                for (const tx of validCandidates) {
                    if (matchedBankIds.has(tx.id)) continue;
                    const txAmt = Math.abs(tx.amount);
                    if (Math.abs(txAmt - invAmount) > 0.01) continue;
                    if (daysDiff(invDate, tx.date) > 5) continue;

                    const extracted = extractSupplier(tx.description || "");
                    const bestSim = Math.max(
                        stringSimilarity(provider, tx.description || ""),
                        extracted ? stringSimilarity(provider, extracted) : 0
                    );

                    if (bestSim >= 0.60) {
                        recordMatch({
                            invoice_id: inv.id,
                            invoice_number: invNumber,
                            provider_code: provider,
                            invoice_amount: invAmount,
                            bank_tx_id: tx.id,
                            bank_amount: tx.amount,
                            bank_date: tx.date,
                            match_type: "provider+exact+5d",
                            confidence: 0.85,
                        });
                        matched = true;
                        break;
                    }
                }
            }

            // S3: invoice_number found in bank description + amount ±0.01 (conf 0.90)
            if (!matched && invNumber && invNumber.length >= 3) {
                const invNumNorm = norm(invNumber);
                for (const tx of validCandidates) {
                    if (matchedBankIds.has(tx.id)) continue;
                    const txAmt = Math.abs(tx.amount);
                    if (Math.abs(txAmt - invAmount) > 0.01) continue;

                    const descNorm = norm(tx.description || "");
                    if (descNorm.includes(invNumNorm)) {
                        recordMatch({
                            invoice_id: inv.id,
                            invoice_number: invNumber,
                            provider_code: provider,
                            invoice_amount: invAmount,
                            bank_tx_id: tx.id,
                            bank_amount: tx.amount,
                            bank_date: tx.date,
                            match_type: "invoice_number+amount",
                            confidence: 0.90,
                        });
                        matched = true;
                        break;
                    }
                }
            }

            // S4: provider fuzzy ≥60% + amount ±2% + date ±7d (conf 0.70)
            if (!matched) {
                for (const tx of validCandidates) {
                    if (matchedBankIds.has(tx.id)) continue;
                    const txAmt = Math.abs(tx.amount);
                    const tolerance = Math.max(1, invAmount * 0.02);
                    if (Math.abs(txAmt - invAmount) > tolerance) continue;
                    if (daysDiff(invDate, tx.date) > 7) continue;

                    const extracted = extractSupplier(tx.description || "");
                    const bestSim = Math.max(
                        stringSimilarity(provider, tx.description || ""),
                        extracted ? stringSimilarity(provider, extracted) : 0
                    );

                    if (bestSim >= 0.60) {
                        recordMatch({
                            invoice_id: inv.id,
                            invoice_number: invNumber,
                            provider_code: provider,
                            invoice_amount: invAmount,
                            bank_tx_id: tx.id,
                            bank_amount: tx.amount,
                            bank_date: tx.date,
                            match_type: "provider+amount2pct+7d",
                            confidence: 0.70,
                        });
                        matched = true;
                        break;
                    }
                }
            }

            // S5: exact amount ±0.01 + date ±3d without provider (conf 0.55)
            if (!matched) {
                let bestTx: any = null;
                let bestDays = Infinity;
                for (const tx of validCandidates) {
                    if (matchedBankIds.has(tx.id)) continue;
                    const txAmt = Math.abs(tx.amount);
                    if (Math.abs(txAmt - invAmount) > 0.01) continue;
                    const days = daysDiff(invDate, tx.date);
                    if (days <= 3 && days < bestDays) {
                        bestDays = days;
                        bestTx = tx;
                    }
                }
                if (bestTx) {
                    recordMatch({
                        invoice_id: inv.id,
                        invoice_number: invNumber,
                        provider_code: provider,
                        invoice_amount: invAmount,
                        bank_tx_id: bestTx.id,
                        bank_amount: bestTx.amount,
                        bank_date: bestTx.date,
                        match_type: "amount+date_only",
                        confidence: 0.55,
                    });
                }
            }
        }

        console.log(`[ap-bank] Matched: ${matches.length} | By strategy: ${JSON.stringify(stats)}`);

        // 5. Apply if not dry run
        let applied = 0;
        const errors: string[] = [];

        if (!dryRun && matches.length > 0) {
            // Group matches by bank_tx_id (multiple invoices → 1 bank tx)
            const byBankTx = new Map<string, APMatch[]>();
            for (const m of matches) {
                if (!byBankTx.has(m.bank_tx_id)) byBankTx.set(m.bank_tx_id, []);
                byBankTx.get(m.bank_tx_id)!.push(m);
            }

            for (const [bankTxId, invMatches] of byBankTx) {
                try {
                    const now = new Date().toISOString();
                    const totalInvoiceAmount = invMatches.reduce((s, m) => s + m.invoice_amount, 0);
                    const invoiceNumbers = invMatches.map(m => m.invoice_number).filter(Boolean).join(", ");
                    const providers = [...new Set(invMatches.map(m => m.provider_code))].join(", ");

                    // Update each AP invoice
                    for (const m of invMatches) {
                        const { error: invErr } = await supabaseAdmin
                            .from("invoices")
                            .update({
                                is_reconciled: true,
                                reconciled_transaction_id: bankTxId,
                                reconciled_at: now,
                                reconciled_amount: m.invoice_amount,
                            })
                            .eq("id", m.invoice_id);

                        if (invErr) {
                            errors.push(`inv ${m.invoice_id}: ${invErr.message}`);
                            continue;
                        }

                        // Log to invoice_history
                        await supabaseAdmin.from("invoice_history").insert({
                            invoice_id: m.invoice_id,
                            change_type: "reconciled",
                            field_name: "is_reconciled",
                            old_value: "false",
                            new_value: "true",
                            changed_by: "BOTella",
                            metadata: {
                                method: "automatic",
                                api: "ap-bank",
                                match_type: m.match_type,
                                confidence: m.confidence,
                                bank_tx_id: bankTxId,
                                bank_amount: m.bank_amount,
                                bank_date: m.bank_date,
                                reconciled_at: now,
                            },
                        }).then(() => { }).catch(() => { }); // best-effort

                        applied++;
                    }

                    // Update bank transaction
                    await supabaseAdmin
                        .from("csv_rows")
                        .update({
                            reconciled: true,
                            custom_data: {
                                reconciliationType: "automatic",
                                reconciled_at: now,
                                matched_invoice_ids: invMatches.map(m => m.invoice_id),
                                matched_invoice_numbers: invoiceNumbers,
                                matched_invoice_total: totalInvoiceAmount,
                                matched_provider: providers,
                                match_confidence: invMatches[0].confidence,
                                match_type: invMatches[0].match_type,
                                api: "ap-bank",
                            },
                        })
                        .eq("id", bankTxId);

                } catch (err: any) {
                    errors.push(`bankTx ${bankTxId}: ${err.message}`);
                }
            }
        }

        const totalValue = matches.reduce((s, m) => s + m.invoice_amount, 0);

        return NextResponse.json({
            success: true,
            dryRun,
            summary: {
                invoices: invoices.length,
                bankTx: bankTxs.length,
                matched: matches.length,
                applied: dryRun ? 0 : applied,
                totalValue: Math.round(totalValue * 100) / 100,
                byStrategy: stats,
                errors: errors.slice(0, 10),
            },
            matches: matches.slice(0, 50),
        });
    } catch (error: any) {
        console.error("[ap-bank] Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
