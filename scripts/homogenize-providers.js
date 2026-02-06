#!/usr/bin/env node
/**
 * Provider Name Homogenization Script
 * 
 * Detects and groups similar provider names (typos, variations) using
 * Levenshtein distance + normalized comparison. Generates a merge plan
 * that can be reviewed and then applied.
 * 
 * Usage:
 *   node scripts/homogenize-providers.js              # Dry-run: show duplicates
 *   node scripts/homogenize-providers.js --apply      # Apply merge plan
 *   node scripts/homogenize-providers.js --threshold 0.7  # Custom similarity threshold
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Similarity Engine ───────────────────────────────────────────────

function levenshtein(a, b) {
    const m = a.length, n = b.length;
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

function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
        .replace(/[^a-z0-9\s]/g, '')                        // remove special chars
        .replace(/\b(s\.?l\.?|s\.?a\.?|ltd|inc|corp|gmbh|srl|sl|sa)\b/g, '') // remove legal suffixes
        .replace(/\s+/g, ' ')
        .trim();
}

function similarity(a, b) {
    const na = normalize(a);
    const nb = normalize(b);
    if (na === nb) return 1.0;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1.0;
    return 1 - levenshtein(na, nb) / maxLen;
}

// ─── Grouping ────────────────────────────────────────────────────────

function findSimilarGroups(providers, threshold) {
    const groups = [];
    const assigned = new Set();

    // Sort by name length descending (keep longest as canonical)
    const sorted = [...providers].sort((a, b) => b.name.length - a.name.length);

    for (let i = 0; i < sorted.length; i++) {
        if (assigned.has(sorted[i].code)) continue;
        const group = [sorted[i]];
        assigned.add(sorted[i].code);

        for (let j = i + 1; j < sorted.length; j++) {
            if (assigned.has(sorted[j].code)) continue;
            const sim = similarity(sorted[i].name, sorted[j].name);
            if (sim >= threshold) {
                group.push({ ...sorted[j], similarity: sim });
                assigned.add(sorted[j].code);
            }
        }

        if (group.length > 1) {
            groups.push({
                canonical: group[0],  // longest name = canonical
                duplicates: group.slice(1),
            });
        }
    }

    return groups;
}

// ─── Main ────────────────────────────────────────────────────────────

(async () => {
    const args = process.argv.slice(2);
    const applyMode = args.includes('--apply');
    const thresholdIdx = args.indexOf('--threshold');
    const threshold = thresholdIdx >= 0 ? parseFloat(args[thresholdIdx + 1]) : 0.80;

    console.log('╔══════════════════════════════════════════╗');
    console.log('║  Provider Name Homogenization            ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`Mode: ${applyMode ? '🔴 APPLY' : '🟢 DRY-RUN (preview only)'}`);
    console.log(`Similarity threshold: ${(threshold * 100).toFixed(0)}%\n`);

    // 1. Load all providers
    const { data: providers, error } = await supabase
        .from('providers')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error loading providers:', error.message);
        process.exit(1);
    }

    console.log(`Total providers: ${providers.length}\n`);

    // 2. Find similar groups
    const groups = findSimilarGroups(providers, threshold);

    if (groups.length === 0) {
        console.log('✅ No similar provider names found. All names are unique.');
        process.exit(0);
    }

    console.log(`⚠️  Found ${groups.length} group(s) of similar providers:\n`);

    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        console.log(`─── Group ${i + 1} ───`);
        console.log(`  ✅ KEEP:  [${g.canonical.code}] "${g.canonical.name}"`);
        for (const dup of g.duplicates) {
            console.log(`  ❌ MERGE: [${dup.code}] "${dup.name}" (${(dup.similarity * 100).toFixed(0)}% similar)`);
        }
        console.log('');
    }

    // 3. Count affected invoices
    let totalAffected = 0;
    for (const g of groups) {
        const dupCodes = g.duplicates.map(d => d.code);
        const { count } = await supabase
            .from('ar_invoices')
            .select('id', { count: 'exact', head: true })
            .in('provider_code', dupCodes);
        totalAffected += (count || 0);
    }

    console.log(`📊 Total invoices that would be re-assigned: ${totalAffected}`);

    if (!applyMode) {
        console.log('\n💡 Run with --apply to execute the merge.');
        console.log('   Example: node scripts/homogenize-providers.js --apply');
        console.log('   Use --threshold 0.7 for more aggressive matching.');
        process.exit(0);
    }

    // 4. Apply merge
    console.log('\n🔄 Applying merge...\n');

    for (const g of groups) {
        const canonicalCode = g.canonical.code;

        for (const dup of g.duplicates) {
            // Update ar_invoices
            const { count: arCount, error: arErr } = await supabase
                .from('ar_invoices')
                .update({ provider_code: canonicalCode })
                .eq('provider_code', dup.code)
                .select('id', { count: 'exact', head: true });

            if (arErr) {
                console.error(`  ❌ Error updating ar_invoices for ${dup.code}:`, arErr.message);
                continue;
            }

            // Update invoices (accounts payable)
            const { error: invErr } = await supabase
                .from('invoices')
                .update({ provider_code: canonicalCode })
                .eq('provider_code', dup.code);

            if (invErr) {
                console.error(`  ❌ Error updating invoices for ${dup.code}:`, invErr.message);
                continue;
            }

            // Deactivate duplicate provider
            const { error: deactivateErr } = await supabase
                .from('providers')
                .update({
                    is_active: false,
                    name: `[MERGED→${canonicalCode}] ${dup.name}`
                })
                .eq('code', dup.code);

            if (deactivateErr) {
                console.error(`  ❌ Error deactivating ${dup.code}:`, deactivateErr.message);
                continue;
            }

            console.log(`  ✅ Merged [${dup.code}] "${dup.name}" → [${canonicalCode}] "${g.canonical.name}"`);
        }
    }

    console.log('\n✅ Merge complete!');
})();
