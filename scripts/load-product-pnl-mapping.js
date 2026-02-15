#!/usr/bin/env node
/**
 * Script: Load Product → P&L Line Mapping
 * 
 * 1. Lê o "Revenue Import.csv" (public/) para extrair o mapeamento REAL
 *    Produto → Financial Account Code (fonte de verdade da contabilidade)
 * 2. Homogeneiza nomes de produtos duplicados por erros de digitação
 * 3. Atualiza a tabela `products` com o financial_account_code correto
 * 4. Atualiza csv_rows (invoice-orders) sem FA code
 * 
 * Uso: node scripts/load-product-pnl-mapping.js [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = process.argv.includes("--dry-run");

// ════════════════════════════════════════════
// P&L Line names (for display)
// ════════════════════════════════════════════
const FA_NAMES = {
    "101.0": "Growth",
    "101.1": "DSD Courses",
    "101.2": "Others Courses",
    "101.3": "Mastership",
    "101.4": "PC Membership",
    "101.5": "Partnerships",
    "101.6": "Level 2 Membership",
    "102.0": "Delight",
    "102.1": "Contracted ROW",
    "102.2": "Contracted AMEX",
    "102.3": "Level 3 New ROW",
    "102.4": "Level 3 New AMEX",
    "102.5": "Consultancies",
    "102.6": "Marketing Coaching",
    "102.7": "Others",
    "103.0": "Planning Center",
    "103.1": "Level 3 ROW",
    "103.2": "Level 3 AMEX",
    "103.3": "Level 3 New ROW",
    "103.4": "Level 3 New AMEX",
    "103.5": "Level 2",
    "103.6": "Level 1",
    "103.7": "Not a Subscriber",
    "103.9": "Allocation",
    "104.0": "LAB",
    "104.1": "Level 3 ROW",
    "104.2": "Level 3 AMEX",
    "104.3": "Level 3 New ROW",
    "104.4": "Level 3 New AMEX",
    "104.5": "Level 2",
    "104.6": "Level 1",
    "104.7": "Not a Subscriber",
    "105.0": "Other Income",
    "105.1": "Level 1 Subscriptions",
    "105.2": "CORE Partnerships",
    "105.3": "Study Club",
    "105.4": "Other Marketing Revenues",
};

// ════════════════════════════════════════════
// STEP 1: Parse Revenue Import CSV
// ════════════════════════════════════════════
function parseRevenueImport() {
    const csvPath = path.join(__dirname, "..", "public", "Revenue Import.csv");
    const raw = fs.readFileSync(csvPath, "utf-8");
    const lines = raw.split("\n");

    // Header (semicolon-separated)
    const header = lines[0].split(";");
    const faIdx = header.findIndex(h => h.trim() === "Financial Account");
    const prodIdx = header.findIndex(h => h.trim() === "Products - Clean");

    if (faIdx === -1 || prodIdx === -1) {
        console.error("❌ Colunas 'Financial Account' ou 'Products - Clean' não encontradas no header");
        console.log("   Headers encontrados:", header.slice(0, 10));
        process.exit(1);
    }

    console.log(`📄 Revenue Import: ${lines.length - 1} linhas, FA col=${faIdx}, Product col=${prodIdx}`);

    // Extrair mapeamentos únicos por contagem (produto → FA code mais frequente)
    // productName → { faCode → count }
    const productFAMap = {};
    let parsed = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(";");
        if (cols.length <= Math.max(faIdx, prodIdx)) continue;

        const rawFA = (cols[faIdx] || "").trim();
        const rawProduct = (cols[prodIdx] || "").trim();

        if (!rawProduct || !rawFA) { skipped++; continue; }

        // Parse FA code: "   101.1 - DSD Courses" → "101.1"
        const faMatch = rawFA.match(/(\d{3}\.\d+)/);
        if (!faMatch) { skipped++; continue; }

        const faCode = faMatch[1];
        const productName = rawProduct;

        if (!productFAMap[productName]) productFAMap[productName] = {};
        productFAMap[productName][faCode] = (productFAMap[productName][faCode] || 0) + 1;
        parsed++;
    }

    console.log(`   ✅ ${parsed} linhas parseadas, ${skipped} ignoradas`);

    // Resolver: para cada produto, pegar o FA code mais frequente
    const productMapping = {};
    for (const [product, faCounts] of Object.entries(productFAMap)) {
        const sorted = Object.entries(faCounts).sort((a, b) => b[1] - a[1]);
        const bestFA = sorted[0][0];
        const bestCount = sorted[0][1];
        const totalCount = sorted.reduce((s, [, c]) => s + c, 0);
        const confidence = totalCount > 0 ? bestCount / totalCount : 0;

        productMapping[product] = {
            faCode: bestFA,
            faName: FA_NAMES[bestFA] || bestFA,
            confidence,
            count: totalCount,
            alternatives: sorted.length > 1 ? sorted.slice(1).map(([c]) => c) : [],
        };
    }

    console.log(`   📦 ${Object.keys(productMapping).length} produtos únicos mapeados`);
    return productMapping;
}

// ════════════════════════════════════════════
// STEP 2: Fuzzy matching para nomes duplicados
// ════════════════════════════════════════════
function normalizeForComparison(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
}

/**
 * Normalize for dedup comparison — strips numbers, dates, installment info
 * so we can catch TRUE typos (casing, extra spaces) not different products
 */
function normalizeForDedup(name) {
    return name
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        // Remove installment references (these are different products)
        .replace(/\b\d+\s*instalments?\b/gi, "")
        .replace(/\bdoctor\s*\d*\b/gi, "")
        // Remove dates (month year) — different events
        .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{4}\b/gi, "")
        // Remove invoice/credit note numbers
        .replace(/#[a-z0-9-]+/gi, "")
        .replace(/r\d{4}-\d{4}/gi, "")
        // Remove unit counts
        .replace(/\b\d+\s*units?\b/gi, "")
        // Remove level references (Level 1 vs Level 2 are different products)
        .replace(/\blevel\s*\d+\b/gi, "")
        // Remove upper/lower (different products)
        .replace(/\b(upper|lower)\b/gi, "")
        // Remove zone/region references
        .replace(/\bzone\s*[a-z]\b/gi, "")
        // Remove payment references
        .replace(/\b(1st|2nd|3rd|4th)\s*payment\b/gi, "")
        // Clean up
        .replace(/\s+/g, " ")
        .trim();
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
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

function findDuplicateGroups(productNames) {
    const items = productNames.map(n => ({ original: n, norm: normalizeForComparison(n) }));
    const groups = [];
    const used = new Set();

    for (let i = 0; i < items.length; i++) {
        if (used.has(i)) continue;
        const group = [items[i].original];

        for (let j = i + 1; j < items.length; j++) {
            if (used.has(j)) continue;

            const a = items[i].norm;
            const b = items[j].norm;

            // ONLY true typos: the normalized versions (lowercase, single space, no punctuation)
            // must be EXACTLY equal. This catches:
            // - "DSD Clinic Monthly fee" vs "DSD Clinic Monthly Fee" (casing)
            // - "DSD Implant  Abutment" vs "DSD Implant Abutment" (extra space)
            // - "Fractional CMO Service" vs "Fractional CMO service" (casing)
            // But does NOT merge:
            // - "Upper" vs "Lower", "Level 1" vs "Level 2", different dates, etc.
            if (a === b) {
                group.push(items[j].original);
                used.add(j);
            }
        }

        if (group.length > 1) {
            groups.push(group);
        }
        used.add(i);
    }

    return groups;
}

function pickCanonicalName(group) {
    // Pick the longest name (likely more complete), or most common casing
    return group.reduce((best, name) => {
        // Prefer names without double spaces
        const bestDouble = (best.match(/  /g) || []).length;
        const nameDouble = (name.match(/  /g) || []).length;
        if (nameDouble < bestDouble) return name;
        if (nameDouble > bestDouble) return best;
        // Prefer longer
        if (name.length > best.length) return name;
        return best;
    }, group[0]);
}

// ════════════════════════════════════════════
// STEP 3: Main execution
// ════════════════════════════════════════════
async function main() {
    console.log("═══════════════════════════════════════════════");
    console.log("🔄 Product → P&L Line Mapping Loader");
    console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "PRODUCTION"}`);
    console.log("═══════════════════════════════════════════════\n");

    // 1. Parse Revenue Import for mappings
    const revenueMapping = parseRevenueImport();

    // 2. Find duplicate product names
    const allProductNames = Object.keys(revenueMapping);
    const duplicateGroups = findDuplicateGroups(allProductNames);

    console.log(`\n🔍 Duplicate groups found: ${duplicateGroups.length}`);

    // Build rename map: variant → canonical
    const renameMap = {};
    for (const group of duplicateGroups) {
        const canonical = pickCanonicalName(group);
        console.log(`   📝 "${canonical}" ← [${group.filter(n => n !== canonical).map(n => `"${n}"`).join(", ")}]`);
        for (const name of group) {
            if (name !== canonical) {
                renameMap[name] = canonical;
                // Merge FA mapping if needed (canonical keeps its own)
                if (!revenueMapping[canonical] && revenueMapping[name]) {
                    revenueMapping[canonical] = revenueMapping[name];
                }
            }
        }
    }

    // 3. Load existing products from Supabase
    console.log("\n📊 Loading existing products from Supabase...");
    const { data: existingProducts, error: prodErr } = await supabase
        .from("products")
        .select("id, code, name, financial_account_code, is_active, alternative_names")
        .order("name");

    if (prodErr) {
        console.error("❌ Error loading products:", prodErr.message);
        process.exit(1);
    }

    console.log(`   Found ${existingProducts.length} existing products`);

    // Build lookup: normalized name → existing product
    const existingByNorm = {};
    for (const p of existingProducts) {
        existingByNorm[normalizeForComparison(p.name)] = p;
    }

    // 4. Process each mapped product
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let alreadyCorrect = 0;
    const updates = [];
    const creates = [];

    for (const [rawProductName, mapping] of Object.entries(revenueMapping)) {
        // Use canonical name if this is a variant
        const productName = renameMap[rawProductName] || rawProductName;
        const normName = normalizeForComparison(productName);

        // Skip products that are just adjustment notes, credit notes, etc.
        if (productName.match(/^(credit note|credit notes|100% discount|25% clinic|clinic credit|clinic discount)/i)) {
            skippedCount++;
            continue;
        }

        const existing = existingByNorm[normName];

        // For P&L assignment, use main account (e.g., 103.1 → 103.0 for product-level)
        // But keep the more specific code for the product
        const faCode = mapping.faCode;
        const faName = mapping.faName;

        if (existing) {
            // Product exists - update if FA code is missing or different
            if (existing.financial_account_code === faCode) {
                alreadyCorrect++;
                continue;
            }

            const updateData = {
                financial_account_code: faCode,
            };

            // If this is a renamed variant, add the old name to alternative_names
            if (renameMap[rawProductName]) {
                const altNames = existing.alternative_names || [];
                if (!altNames.includes(rawProductName)) {
                    updateData.alternative_names = [...altNames, rawProductName];
                }
            }

            updates.push({ id: existing.id, name: existing.name, ...updateData, oldCode: existing.financial_account_code });
        } else {
            // Product doesn't exist - create it
            // Generate a product code
            const codeNum = 900 + createdCount + creates.length;
            creates.push({
                name: productName,
                code: `PROD-${codeNum}`,
                financial_account_code: faCode,
                product_type: "service",
                scope: "GLOBAL",
                is_active: true,
                category: getCategoryFromFA(faCode),
                alternative_names: renameMap[rawProductName] ? [rawProductName] : [],
            });
        }
    }

    console.log("\n═══════════════════════════════════════════════");
    console.log("📋 Summary:");
    console.log(`   ✅ Already correct: ${alreadyCorrect}`);
    console.log(`   🔄 To update FA code: ${updates.length}`);
    console.log(`   ➕ To create: ${creates.length}`);
    console.log(`   ⏭️  Skipped (credit notes etc.): ${skippedCount}`);
    console.log("═══════════════════════════════════════════════\n");

    // Show updates preview
    if (updates.length > 0) {
        console.log("🔄 Updates preview (first 30):");
        for (const u of updates.slice(0, 30)) {
            console.log(`   "${u.name}": ${u.oldCode || "null"} → ${u.financial_account_code} (${FA_NAMES[u.financial_account_code] || "?"})`);
        }
        if (updates.length > 30) console.log(`   ... +${updates.length - 30} more`);
    }

    // Show creates preview
    if (creates.length > 0) {
        console.log("\n➕ Creates preview (first 30):");
        for (const c of creates.slice(0, 30)) {
            console.log(`   "${c.name}" → ${c.financial_account_code} (${FA_NAMES[c.financial_account_code] || "?"})`);
        }
        if (creates.length > 30) console.log(`   ... +${creates.length - 30} more`);
    }

    if (DRY_RUN) {
        console.log("\n⚠️  DRY RUN - no changes made. Run without --dry-run to apply.");
        return;
    }

    // 5. Apply updates
    console.log("\n🚀 Applying changes...");

    for (const u of updates) {
        const updatePayload = { financial_account_code: u.financial_account_code };
        if (u.alternative_names) updatePayload.alternative_names = u.alternative_names;

        const { error } = await supabase
            .from("products")
            .update(updatePayload)
            .eq("id", u.id);

        if (error) {
            console.error(`   ❌ Error updating "${u.name}":`, error.message);
        } else {
            updatedCount++;
        }
    }

    console.log(`   ✅ Updated ${updatedCount}/${updates.length} products`);

    // 6. Create new products (check code conflict first)
    if (creates.length > 0) {
        // Get max existing PROD-XXX code (fetch all and compute numerically to avoid lexicographic sort issues)
        let nextNum = 900;
        const { data: allCodes } = await supabase
            .from("products")
            .select("code")
            .limit(5000);

        if (allCodes && allCodes.length > 0) {
            let maxNum = 0;
            for (const row of allCodes) {
                const m = (row.code || "").match(/PROD-(\d+)/);
                if (m) {
                    const n = parseInt(m[1]);
                    if (n > maxNum) maxNum = n;
                }
            }
            if (maxNum >= nextNum) nextNum = maxNum + 1;
        }

        console.log(`   Starting code sequence at PROD-${nextNum}`);

        for (const c of creates) {
            c.code = `PROD-${nextNum++}`;
            const { error } = await supabase.from("products").insert(c);
            if (error) {
                // Retry with next code on conflict
                if (error.message.includes("unique") || error.message.includes("duplicate")) {
                    c.code = `PROD-${nextNum++}`;
                    const { error: e2 } = await supabase.from("products").insert(c);
                    if (e2) console.error(`   ❌ Error creating "${c.name}":`, e2.message);
                    else createdCount++;
                } else {
                    console.error(`   ❌ Error creating "${c.name}":`, error.message);
                }
            } else {
                createdCount++;
            }
        }

        console.log(`   ✅ Created ${createdCount}/${creates.length} products`);
    }

    // 7. Update csv_rows (invoice-orders) that have missing or empty financial_account_code
    console.log("\n🔄 Updating invoice-orders csv_rows with missing FA codes...");
    await updateInvoiceOrderRows(revenueMapping, renameMap);

    console.log("\n✅ Done!");
}

async function updateInvoiceOrderRows(revenueMapping, renameMap) {
    // Load all invoice-orders rows
    const PAGE = 1000;
    let allRows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from("csv_rows")
            .select("id, description, custom_data")
            .eq("source", "invoice-orders")
            .range(from, from + PAGE - 1);

        if (error) { console.error("   ❌ Error loading csv_rows:", error.message); break; }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
    }

    console.log(`   Loaded ${allRows.length} invoice-order rows`);

    let updated = 0;
    let alreadyOk = 0;
    let noMapping = 0;

    for (const row of allRows) {
        const cd = row.custom_data || {};

        // Skip if already has FA code
        if (cd.financial_account_code) { alreadyOk++; continue; }

        const productName = row.description || "";
        // Try direct match
        let mapping = revenueMapping[productName];

        // Try canonical name
        if (!mapping && renameMap[productName]) {
            mapping = revenueMapping[renameMap[productName]];
        }

        // Try normalized match
        if (!mapping) {
            const norm = normalizeForComparison(productName);
            for (const [key, val] of Object.entries(revenueMapping)) {
                if (normalizeForComparison(key) === norm) {
                    mapping = val;
                    break;
                }
            }
        }

        if (!mapping) { noMapping++; continue; }

        if (DRY_RUN) { updated++; continue; }

        const newCd = {
            ...cd,
            financial_account_code: mapping.faCode,
            financial_account_name: mapping.faName,
        };

        const { error } = await supabase
            .from("csv_rows")
            .update({ custom_data: newCd })
            .eq("id", row.id);

        if (error) {
            console.error(`   ❌ Error updating row ${row.id}:`, error.message);
        } else {
            updated++;
        }
    }

    console.log(`   ✅ Updated: ${updated}, Already OK: ${alreadyOk}, No mapping: ${noMapping}`);
}

function getCategoryFromFA(faCode) {
    if (!faCode) return "Other";
    const prefix = faCode.split(".")[0];
    switch (prefix) {
        case "101": return "Course";
        case "102": return "Clinic Fee";
        case "103": return "Other"; // Planning Center products have varied categories
        case "104": return "Other"; // LAB products have varied categories
        case "105": return "Subscription";
        default: return "Other";
    }
}

main().catch(err => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
});
