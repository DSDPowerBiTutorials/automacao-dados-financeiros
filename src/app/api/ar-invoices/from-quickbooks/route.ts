import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// ============================================================
// Rota para transferir csv_rows(quickbooks-invoices) → ar_invoices
// - Email enrichment: quickbooks_customers table + invoice-orders name match
// - Financial Account: replicate last monthly fee FA or default 102.4
// - Context: scope="US", country_code="US", billing_entity="DSD US LLC"
// ============================================================

// Monthly fee FA codes (Delight / Clinics)
const MONTHLY_FEE_FA_CODES = ["102.1", "102.2", "102.3", "102.4"];
const DEFAULT_NEW_FA = "102.4"; // Level 3 New AMEX

// Simple name normalization for matching
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Basic Levenshtein distance
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

// Name similarity score (0-100)
function nameSimilarity(a: string, b: string): number {
    if (a === b) return 100;
    if (!a || !b) return 0;
    // Containment check
    if (a.includes(b) || b.includes(a)) return 90;
    // Word-level overlap
    const wordsA = a.split(" ").filter(Boolean);
    const wordsB = b.split(" ").filter(Boolean);
    const common = wordsA.filter(w => wordsB.includes(w)).length;
    const wordScore = (2 * common) / (wordsA.length + wordsB.length) * 100;
    if (wordScore >= 80) return wordScore;
    // Levenshtein
    const maxLen = Math.max(a.length, b.length);
    const levScore = ((maxLen - levenshtein(a, b)) / maxLen) * 100;
    return Math.max(wordScore, levScore);
}

export async function POST(req: NextRequest) {
    try {
        console.log("🔄 [from-quickbooks] Syncing csv_rows(quickbooks-invoices) → ar_invoices...");

        // 1. Fetch all QB invoices from csv_rows
        let allRows: any[] = [];
        let offset = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("*")
                .eq("source", "quickbooks-invoices")
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows = allRows.concat(data);
            if (data.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        }

        console.log(`📦 Total csv_rows quickbooks-invoices: ${allRows.length}`);

        if (allRows.length === 0) {
            return NextResponse.json({ success: true, created: 0, message: "No QB invoices found" });
        }

        // 2. Load quickbooks_customers for email lookup (by customer_id)
        const { data: qbCustomers, error: qbCustErr } = await supabaseAdmin
            .from("quickbooks_customers")
            .select("id, display_name, company_name, email");
        if (qbCustErr) console.error("⚠️ Error loading QB customers:", qbCustErr.message);

        const qbCustById = new Map<string, { email: string | null; display_name: string; company_name: string | null }>();
        (qbCustomers || []).forEach(c => {
            qbCustById.set(String(c.id), {
                email: c.email || null,
                display_name: c.display_name || "",
                company_name: c.company_name || null,
            });
        });

        console.log(`📇 QB customers loaded: ${qbCustById.size} (${(qbCustomers || []).filter(c => c.email).length} with email)`);

        // 3. Load invoice-orders for email + FA enrichment
        //    Build name→email and name→lastFA maps
        const nameToEmail = new Map<string, string>(); // normalized name → email
        const nameToLastFA = new Map<string, { code: string; date: string }>(); // normalized name → latest monthly fee FA
        const emailToLastFA = new Map<string, { code: string; date: string }>(); // email → latest monthly fee FA

        let ioOffset = 0;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("custom_data")
                .eq("source", "invoice-orders")
                .range(ioOffset, ioOffset + PAGE_SIZE - 1);
            if (error) { console.error("⚠️ Error loading invoice-orders:", error.message); break; }
            if (!data || data.length === 0) break;

            for (const row of data) {
                const cd = row.custom_data || {};
                const custName = String(cd.customer_name || "").trim();
                const email = String(cd.email || "").trim().toLowerCase();
                const faCode = String(cd.financial_account_code || "").trim();
                const invoiceDate = String(cd.invoice_date || "").trim();

                if (custName) {
                    const normN = normalizeName(custName);
                    // Store email by name (first encountered is fine, most have consistent email)
                    if (email && !nameToEmail.has(normN)) {
                        nameToEmail.set(normN, email);
                    }
                    // Track latest monthly fee FA by name
                    if (MONTHLY_FEE_FA_CODES.includes(faCode) && invoiceDate) {
                        const existing = nameToLastFA.get(normN);
                        if (!existing || invoiceDate > existing.date) {
                            nameToLastFA.set(normN, { code: faCode, date: invoiceDate });
                        }
                    }
                }
                // Track latest monthly fee FA by email
                if (email && MONTHLY_FEE_FA_CODES.includes(faCode) && invoiceDate) {
                    const existing = emailToLastFA.get(email);
                    if (!existing || invoiceDate > existing.date) {
                        emailToLastFA.set(email, { code: faCode, date: invoiceDate });
                    }
                }
            }

            if (data.length < PAGE_SIZE) break;
            ioOffset += PAGE_SIZE;
        }

        console.log(`📊 Invoice-orders: ${nameToEmail.size} names with email, ${nameToLastFA.size} names with monthly fee FA, ${emailToLastFA.size} emails with monthly fee FA`);

        // 4. Preserve existing reconciliations
        const { data: existingRecords } = await supabaseAdmin
            .from("ar_invoices")
            .select("source_id, reconciled, reconciled_at, reconciled_with, reconciliation_type, reconciled_by, payment_reference")
            .eq("source", "quickbooks");

        const existingRecon = new Map<string, any>();
        (existingRecords || []).forEach(rec => {
            if (rec.reconciled) {
                existingRecon.set(rec.source_id, {
                    reconciled: rec.reconciled,
                    reconciled_at: rec.reconciled_at,
                    reconciled_with: rec.reconciled_with,
                    reconciliation_type: rec.reconciliation_type,
                    reconciled_by: rec.reconciled_by,
                    payment_reference: rec.payment_reference,
                });
            }
        });

        console.log(`🔒 Preserving ${existingRecon.size} existing reconciliations`);

        // 5. Delete existing quickbooks ar_invoices (will re-insert)
        await supabaseAdmin.from("ar_invoices").delete().eq("source", "quickbooks");

        // 6. Map QB invoices → ar_invoices
        let emailsEnriched = 0;
        let faFromHistory = 0;
        let faDefault = 0;

        const invoices = allRows.map(row => {
            const cd = row.custom_data || {};
            const sourceId = String(row.id);
            const customerName = String(cd.customer_name || "Unknown").trim();
            const customerId = String(cd.customer_id || "");
            const docNumber = String(cd.doc_number || "");
            const totalAmount = parseFloat(String(cd.total_amount || row.amount)) || 0;
            const currency = String(cd.currency || "USD");
            const invoiceDate = cd.due_date || row.date || null;

            // --- Email enrichment ---
            let email: string | null = null;

            // Priority 1: QB customers table (by customer_id)
            if (customerId && qbCustById.has(customerId)) {
                email = qbCustById.get(customerId)!.email;
            }

            // Priority 2: invoice-orders name match (exact normalized)
            const normName = normalizeName(customerName);
            if (!email && normName && nameToEmail.has(normName)) {
                email = nameToEmail.get(normName)!;
            }

            // Priority 3: fuzzy name match against invoice-orders (>= 85%)
            if (!email && normName) {
                let bestScore = 0;
                for (const [ioName, ioEmail] of nameToEmail) {
                    const score = nameSimilarity(normName, ioName);
                    if (score > bestScore && score >= 85) {
                        bestScore = score;
                        email = ioEmail;
                    }
                }
            }

            if (email) emailsEnriched++;

            // --- Financial Account enrichment ---
            let financialAccountCode: string | null = null;

            // Priority 1: by email in invoice-orders history
            if (email && emailToLastFA.has(email)) {
                financialAccountCode = emailToLastFA.get(email)!.code;
                faFromHistory++;
            }

            // Priority 2: by name in invoice-orders history
            if (!financialAccountCode && normName && nameToLastFA.has(normName)) {
                financialAccountCode = nameToLastFA.get(normName)!.code;
                faFromHistory++;
            }

            // Priority 3: fuzzy name match for FA
            if (!financialAccountCode && normName) {
                let bestScore = 0;
                for (const [faName, faData] of nameToLastFA) {
                    const score = nameSimilarity(normName, faName);
                    if (score > bestScore && score >= 85) {
                        bestScore = score;
                        financialAccountCode = faData.code;
                    }
                }
                if (financialAccountCode) faFromHistory++;
            }

            // Default: 102.4 (Level 3 New AMEX) for new customers
            if (!financialAccountCode) {
                financialAccountCode = DEFAULT_NEW_FA;
                faDefault++;
            }

            // Restore reconciliation if exists
            const recon = existingRecon.get(sourceId);

            const base: any = {
                invoice_number: `QB-${docNumber}`,
                order_id: `QBI-${cd.quickbooks_id || docNumber}`,
                order_date: row.date || null,
                order_status: cd.balance === 0 ? "Paid" : "Pending",
                deal_status: cd.balance === 0 ? "Paid" : "Open",
                invoice_date: invoiceDate,
                products: null,
                company_name: customerName,
                client_name: customerName,
                email: email,
                total_amount: totalAmount,
                currency: currency,
                charged_amount: cd.balance === 0 ? totalAmount : (totalAmount - (cd.balance || 0)),
                payment_method: "QuickBooks",
                billing_entity: "DSD US LLC",
                discount_code: null,
                note: `Financial Account: ${financialAccountCode}`,
                status: cd.balance === 0 ? "paid" : "pending",
                country_code: "US",
                scope: "US",
                source: "quickbooks",
                source_id: sourceId,
                source_data: {
                    ...cd,
                    financial_account_code: financialAccountCode,
                    email_source: email
                        ? (customerId && qbCustById.get(customerId)?.email === email ? "quickbooks_customers" : "invoice-orders")
                        : null,
                },
            };

            if (recon) {
                base.reconciled = recon.reconciled;
                base.reconciled_at = recon.reconciled_at;
                base.reconciled_with = recon.reconciled_with;
                base.reconciliation_type = recon.reconciliation_type;
                base.reconciled_by = recon.reconciled_by;
                base.payment_reference = recon.payment_reference;
            }

            return base;
        });

        // 7. Insert in batches
        const BATCH = 100;
        let created = 0;
        let reconPreserved = 0;
        for (let i = 0; i < invoices.length; i += BATCH) {
            const batch = invoices.slice(i, i + BATCH);
            const { error: insertErr } = await supabaseAdmin.from("ar_invoices").insert(batch);
            if (insertErr) {
                console.error(`❌ Error batch ${i}:`, insertErr.message);
                throw insertErr;
            }
            created += batch.length;
            reconPreserved += batch.filter((b: any) => b.reconciled).length;
        }

        console.log(`✅ [from-quickbooks] ${created} ar_invoices created`);
        console.log(`📧 Emails enriched: ${emailsEnriched}/${allRows.length}`);
        console.log(`📊 FA from history: ${faFromHistory}, FA default (102.4): ${faDefault}`);
        console.log(`🔒 Reconciliations preserved: ${reconPreserved}`);

        return NextResponse.json({
            success: true,
            created,
            emailsEnriched,
            faFromHistory,
            faDefault,
            reconciliationsPreserved: reconPreserved,
        });
    } catch (err: any) {
        console.error("❌ [from-quickbooks] Error:", err.message);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
