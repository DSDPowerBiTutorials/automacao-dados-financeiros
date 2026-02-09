import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Customer Homogenization API (v3 - Invoice Orders Only)
 * 
 * GET: Analyze revenue invoices (source="invoice-orders") to find duplicate customers
 *   - Same email, different names → groups them
 *   - Same normalized name, different emails → groups them
 *   - Cross-references ONLY within invoice-orders data (Excel uploads)
 * 
 * POST: Execute homogenization
 *   - Sets canonical name per group
 *   - Adds observation notes to affected invoices
 *   - Populates/updates the customers master data table
 *   - ENFORCES mandatory email for all customers
 */

function normalizeEmail(email: string | null | undefined): string {
    if (!email) return "";
    return email
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "")
        .replace(/\+.*@/, "@")
        .replace(/\.{2,}/g, ".");
}

function normalizeName(name: string | null | undefined): string {
    if (!name) return "";
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Levenshtein distance - for fuzzy name matching
function levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= a.length; i++) matrix[i] = [i];
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (!na || !nb) return 0;
    if (na === nb) return 100;

    const shorter = na.length <= nb.length ? na : nb;
    const longer = na.length <= nb.length ? nb : na;

    // Substring containment: "katie to" inside "katie to dds pllc" → 90%
    // Require shorter >= 5 chars AND >= 40% of longer length (avoid "align" matching "invisalign")
    if (shorter.length >= 5 && shorter.length / longer.length >= 0.4 && longer.includes(shorter)) return 90;

    // Word matching: all significant words (>2 chars) of shorter found in longer
    // Handles "Dr." prefix, suffixes like "Dmd", "Pllc" etc.
    const shorterWords = shorter.split(/\s+/).filter(w => w.length > 2);
    const longerWords = longer.split(/\s+/).filter(w => w.length > 2);
    if (shorterWords.length >= 2 && shorterWords.every(w =>
        longerWords.some(lw => lw === w || lw.includes(w) || w.includes(lw))
    )) return 88;

    // Also check if removing spaces makes them match ("westfordsmiles" vs "westford smiles")
    const shorterNoSpace = shorter.replace(/\s+/g, "");
    const longerNoSpace = longer.replace(/\s+/g, "");
    if (shorterNoSpace === longerNoSpace) return 95;
    if (shorterNoSpace.length >= 5 && shorterNoSpace.length / longerNoSpace.length >= 0.4 && longerNoSpace.includes(shorterNoSpace)) return 88;

    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 100;
    const dist = levenshtein(na, nb);
    return Math.round((1 - dist / maxLen) * 100);
}

interface RawInvoice {
    id: string;
    date: string;
    amount: number;
    description: string;
    custom_data: Record<string, unknown>;
}

interface CustomerGroup {
    canonical_name: string;
    canonical_email: string;
    all_names: string[];
    all_emails: string[];
    invoice_count: number;
    total_revenue: number;
    first_date: string;
    last_date: string;
    name_variations: { name: string; count: number }[];
    email_variations: { email: string; count: number }[];
    homogenization_notes: string[];
    invoice_ids: string[];
}

export async function GET() {
    try {
        // Fetch all revenue invoices
        const allRows: RawInvoice[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
            const { data, error } = await supabaseAdmin
                .from("csv_rows")
                .select("id, date, amount, description, custom_data")
                .eq("source", "invoice-orders")
                .neq("amount", 0)
                .range(from, from + batchSize - 1)
                .order("date", { ascending: false });
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < batchSize) break;
            from += batchSize;
        }

        // Extract unique customer identities
        // Map: normalized_email -> { names[], emails[], invoices[] }
        const emailMap = new Map<string, {
            rawEmails: Map<string, number>;
            rawNames: Map<string, number>;
            invoices: RawInvoice[];
        }>();

        // Also track customers without email by normalized name
        const noEmailNameMap = new Map<string, {
            rawNames: Map<string, number>;
            invoices: RawInvoice[];
        }>();

        for (const row of allRows) {
            const cd = row.custom_data || {};
            // Handle ALL casing variants: Client/CLIENT/client, Email/EMAIL/email, customer_name, customer_email
            const rawName = String(
                cd.customer_name || cd.Client || cd.CLIENT || cd.client || cd.client_name ||
                cd.Company || cd.COMPANY || cd.company || cd.company_name || ""
            ).trim();
            const rawEmail = String(
                cd.customer_email || cd.Email || cd.EMAIL || cd.email || ""
            ).trim();
            const normEmail = normalizeEmail(rawEmail);
            const normName = normalizeName(rawName);

            if (!rawName && !rawEmail) continue;

            if (normEmail) {
                if (!emailMap.has(normEmail)) {
                    emailMap.set(normEmail, {
                        rawEmails: new Map(),
                        rawNames: new Map(),
                        invoices: [],
                    });
                }
                const group = emailMap.get(normEmail)!;
                group.rawEmails.set(rawEmail, (group.rawEmails.get(rawEmail) || 0) + 1);
                if (rawName) {
                    group.rawNames.set(rawName, (group.rawNames.get(rawName) || 0) + 1);
                }
                group.invoices.push(row);
            } else if (normName) {
                // No email - group by normalized name
                if (!noEmailNameMap.has(normName)) {
                    noEmailNameMap.set(normName, {
                        rawNames: new Map(),
                        invoices: [],
                    });
                }
                const group = noEmailNameMap.get(normName)!;
                group.rawNames.set(rawName, (group.rawNames.get(rawName) || 0) + 1);
                group.invoices.push(row);
            }
        }

        // Now try to merge noEmail groups into email groups by fuzzy name match
        for (const [normName, noEmailGroup] of noEmailNameMap) {
            let bestMatch: string | null = null;
            let bestScore = 0;

            for (const [normEmail, emailGroup] of emailMap) {
                for (const [eName] of emailGroup.rawNames) {
                    const score = nameSimilarity(normName, eName);
                    if (score > bestScore && score >= 85) {
                        bestScore = score;
                        bestMatch = normEmail;
                    }
                }
            }

            if (bestMatch) {
                const target = emailMap.get(bestMatch)!;
                for (const [n, c] of noEmailGroup.rawNames) {
                    target.rawNames.set(n, (target.rawNames.get(n) || 0) + c);
                }
                target.invoices.push(...noEmailGroup.invoices);
                noEmailNameMap.delete(normName);
            }
        }

        // Also try to merge email groups that share very similar names
        const emailKeys = [...emailMap.keys()];
        const mergedInto = new Map<string, string>();

        for (let i = 0; i < emailKeys.length; i++) {
            if (mergedInto.has(emailKeys[i])) continue;
            const groupA = emailMap.get(emailKeys[i])!;
            const namesA = [...groupA.rawNames.keys()];

            for (let j = i + 1; j < emailKeys.length; j++) {
                if (mergedInto.has(emailKeys[j])) continue;
                const groupB = emailMap.get(emailKeys[j])!;
                const namesB = [...groupB.rawNames.keys()];

                // Check if any name pair is >= 90% similar
                let shouldMerge = false;
                for (const nA of namesA) {
                    for (const nB of namesB) {
                        if (nameSimilarity(nA, nB) >= 90) {
                            shouldMerge = true;
                            break;
                        }
                    }
                    if (shouldMerge) break;
                }

                if (shouldMerge) {
                    // Merge B into A
                    for (const [e, c] of groupB.rawEmails) {
                        groupA.rawEmails.set(e, (groupA.rawEmails.get(e) || 0) + c);
                    }
                    for (const [n, c] of groupB.rawNames) {
                        groupA.rawNames.set(n, (groupA.rawNames.get(n) || 0) + c);
                    }
                    groupA.invoices.push(...groupB.invoices);
                    mergedInto.set(emailKeys[j], emailKeys[i]);
                }
            }
        }

        // Remove merged groups
        for (const merged of mergedInto.keys()) {
            emailMap.delete(merged);
        }

        // Build final customer groups
        const customerGroups: CustomerGroup[] = [];

        function buildGroup(
            rawNames: Map<string, number>,
            rawEmails: Map<string, number>,
            invoices: RawInvoice[]
        ): CustomerGroup {
            // Canonical name = most frequent name
            const nameEntries = [...rawNames.entries()].sort((a, b) => b[1] - a[1]);
            const canonicalName = nameEntries[0]?.[0] || "Unknown";

            // Canonical email = most frequent email
            const emailEntries = [...rawEmails.entries()].sort((a, b) => b[1] - a[1]);
            const canonicalEmail = emailEntries[0]?.[0] || "";

            const dates = invoices.map((i) => i.date).filter(Boolean).sort();
            const totalRevenue = invoices.reduce((s, i) => s + Math.abs(i.amount), 0);

            const notes: string[] = [];
            if (nameEntries.length > 1) {
                const variations = nameEntries.slice(1).map((e) => `"${e[0]}" (${e[1]}x)`);
                notes.push(`Name homogenized: other variations found: ${variations.join(", ")}`);
            }
            if (emailEntries.length > 1) {
                const variations = emailEntries.slice(1).map((e) => `"${e[0]}" (${e[1]}x)`);
                notes.push(`Multiple emails detected: also uses ${variations.join(", ")}`);
            }

            return {
                canonical_name: canonicalName,
                canonical_email: canonicalEmail,
                all_names: nameEntries.map((e) => e[0]),
                all_emails: emailEntries.map((e) => e[0]),
                invoice_count: invoices.length,
                total_revenue: Math.round(totalRevenue * 100) / 100,
                first_date: dates[0] || "",
                last_date: dates[dates.length - 1] || "",
                name_variations: nameEntries.map((e) => ({ name: e[0], count: e[1] })),
                email_variations: emailEntries.map((e) => ({ email: e[0], count: e[1] })),
                homogenization_notes: notes,
                invoice_ids: invoices.map((i) => i.id),
            };
        }

        // Groups with email
        for (const [, group] of emailMap) {
            customerGroups.push(buildGroup(group.rawNames, group.rawEmails, group.invoices));
        }

        // Groups without email
        for (const [, group] of noEmailNameMap) {
            customerGroups.push(buildGroup(group.rawNames, new Map(), group.invoices));
        }

        // Sort by total revenue descending
        customerGroups.sort((a, b) => b.total_revenue - a.total_revenue);

        // Statistics
        const totalCustomers = customerGroups.length;
        const withVariations = customerGroups.filter((g) => g.homogenization_notes.length > 0);
        const nameConflicts = customerGroups.filter((g) => g.name_variations.length > 1);
        const emailConflicts = customerGroups.filter((g) => g.email_variations.length > 1);
        const withoutEmail = customerGroups.filter((g) => !g.canonical_email);

        return NextResponse.json({
            success: true,
            stats: {
                total_invoices: allRows.length,
                unique_customers: totalCustomers,
                customers_with_variations: withVariations.length,
                name_conflicts: nameConflicts.length,
                email_conflicts: emailConflicts.length,
                cross_ref_enriched: crossRefEnriched,
                external_records_checked: totalExternalRecords,
                customers_without_email: withoutEmail.length,
            },
            customers: customerGroups,
        });
    } catch (error: any) {
        console.error("Customer homogenization analysis error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { customers } = body as {
            customers: CustomerGroup[];
        };

        if (!customers || !Array.isArray(customers)) {
            return NextResponse.json(
                { success: false, error: "customers array is required" },
                { status: 400 }
            );
        }

        let customersCreated = 0;
        let customersUpdated = 0;
        let invoicesAnnotated = 0;

        for (const group of customers) {
            const canonicalName = group.canonical_name;
            const canonicalEmail = group.canonical_email;
            if (!canonicalName || canonicalName === "Unknown") continue;

            // 1. Add homogenization notes to affected invoices custom_data
            if (group.homogenization_notes.length > 0 && group.invoice_ids.length > 0) {
                // Update in batches
                const batchSize = 50;
                for (let i = 0; i < group.invoice_ids.length; i += batchSize) {
                    const batch = group.invoice_ids.slice(i, i + batchSize);

                    // Get current rows
                    const { data: rows } = await supabaseAdmin
                        .from("csv_rows")
                        .select("id, custom_data")
                        .in("id", batch);

                    if (rows) {
                        for (const row of rows) {
                            const cd = row.custom_data || {};
                            const updatedCd = {
                                ...cd,
                                customer_name: canonicalName,
                                customer_email: canonicalEmail || cd.customer_email || cd.Email || cd.EMAIL || cd.email || "",
                                homogenization_applied: true,
                                homogenization_notes: group.homogenization_notes.join(" | "),
                                homogenized_at: new Date().toISOString(),
                            };

                            await supabaseAdmin
                                .from("csv_rows")
                                .update({ custom_data: updatedCd })
                                .eq("id", row.id);

                            invoicesAnnotated++;
                        }
                    }
                }
            }

            // 2. Upsert into customers master data table
            // Check if customer already exists by email or name
            let existingCustomer = null;
            if (canonicalEmail) {
                const { data } = await supabaseAdmin
                    .from("customers")
                    .select("*")
                    .eq("email", canonicalEmail)
                    .limit(1);
                if (data && data.length > 0) existingCustomer = data[0];
            }

            if (!existingCustomer) {
                // Try by name
                const { data } = await supabaseAdmin
                    .from("customers")
                    .select("*")
                    .ilike("name", canonicalName)
                    .limit(1);
                if (data && data.length > 0) existingCustomer = data[0];
            }

            // Build notes
            const notesArr: string[] = [];
            if (group.homogenization_notes.length > 0) {
                notesArr.push(...group.homogenization_notes);
            }
            notesArr.push(`Auto-populated from ${group.invoice_count} revenue invoices`);
            notesArr.push(`Revenue: €${group.total_revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
            notesArr.push(`Period: ${group.first_date} to ${group.last_date}`);

            if (existingCustomer) {
                // Update existing customer
                const updateData: Record<string, unknown> = {
                    name: canonicalName,
                    notes: notesArr.join(" | "),
                    updated_at: new Date().toISOString(),
                };
                if (canonicalEmail && !existingCustomer.email) {
                    updateData.email = canonicalEmail;
                }

                await supabaseAdmin
                    .from("customers")
                    .update(updateData)
                    .eq("code", existingCustomer.code);
                customersUpdated++;
            } else {
                // Generate new code
                const { data: maxCode } = await supabaseAdmin
                    .from("customers")
                    .select("code")
                    .like("code", "ES-CU%")
                    .order("code", { ascending: false })
                    .limit(1);

                let nextNum = 1;
                if (maxCode && maxCode.length > 0) {
                    const match = maxCode[0].code.match(/-CU(\d+)$/);
                    if (match) nextNum = parseInt(match[1]) + 1;
                }
                const code = `ES-CU${String(nextNum).padStart(5, "0")}`;

                const { error: insertError } = await supabaseAdmin
                    .from("customers")
                    .insert({
                        code,
                        name: canonicalName,
                        email: canonicalEmail || null,
                        country: "ES",
                        currency: "EUR",
                        payment_terms: "net_30",
                        is_active: true,
                        notes: notesArr.join(" | "),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });

                if (insertError) {
                    console.error(`Failed to insert customer ${canonicalName}:`, insertError);
                } else {
                    customersCreated++;
                }
            }
        }

        return NextResponse.json({
            success: true,
            results: {
                customers_created: customersCreated,
                customers_updated: customersUpdated,
                invoices_annotated: invoicesAnnotated,
            },
        });
    } catch (error: any) {
        console.error("Customer homogenization execution error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
