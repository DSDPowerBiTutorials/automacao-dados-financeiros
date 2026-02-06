#!/usr/bin/env node
/**
 * Import Expenses to Accounts Payable
 * 
 * Reads public/epenses.csv, cleans provider names, deduplicates them,
 * upserts providers into master data, deletes existing manual invoices,
 * and inserts all expense rows as invoices.
 * 
 * Usage:
 *   node scripts/import-expenses-ap.js              # Dry-run (preview)
 *   node scripts/import-expenses-ap.js --apply      # Execute changes
 *   node scripts/import-expenses-ap.js --apply --skip-delete  # Insert only, keep existing invoices
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CSV_PATH = path.join(__dirname, '..', 'public', 'epenses.csv');
const SIMILARITY_THRESHOLD = 0.85;
const BATCH_SIZE = 200;

// Map CSV Group → invoice_type
const GROUP_MAP = {
    'Incurred': 'INCURRED',
    'Budget': 'BUDGET',
    'Balance Adjustment': 'ADJUSTMENT',
};

// Map CSV Group → entry_type code
const ENTRY_TYPE_MAP = {
    'Incurred': 'INCURRED',
    'Budget': 'BUDGET',
    'Balance Adjustment': 'BALANCE_ADJUSTMENT',
};

// Map Sub-Group FA code → dep_cost_type
const FA_TO_DEP_COST_TYPE = {
    '201': 'COGS',
    '202': 'LABOUR',
    '203': 'GENEXP',
    '204': 'GENEXP',
    '205': 'GENEXP',
    '206': 'GENEXP',
    '207': 'GENEXP',
    '208': 'GENEXP',
    '209': 'GENEXP',
    '210': 'GENEXP',
    '211': 'DEDEXP',
    '300': 'GENEXP',
    '400': 'GENEXP',
    '0000': 'GENEXP',
};

// Map FA prefix → cost_type
const FA_TO_COST_TYPE = {
    '201': 'COGS',
    '202': 'PERSONNEL',
    '203': 'VARIABLE',
    '204': 'VARIABLE',
    '205': 'VARIABLE',
    '206': 'FIXED',
    '207': 'FIXED',
    '208': 'VARIABLE',
    '209': 'VARIABLE',
    '210': 'VARIABLE',
    '211': 'FIXED',
    '300': 'VARIABLE',
    '400': 'FIXED',
    '0000': 'VARIABLE',
};

// Map FA prefix → cost_center
const FA_TO_COST_CENTER = {
    '201.1': '1.0.0', '201.2': '1.0.0', '201.3': '1.0.0', '201.4': '2.0.0', '201.5': '3.0.0', '201.6': '3.0.0',
    '202.1': '1.0.0', '202.2': '3.0.0', '202.3': '1.0.0', '202.4': '2.0.0', '202.5': '3.0.0', '202.6': '1.0.0', '202.7': '1.0.0',
    '203.1': '1.0.0', '203.2': '3.0.0', '203.3': '1.0.0', '203.4': '2.0.0', '203.5': '3.0.0', '203.6': '1.0.0', '203.7': '1.0.0',
    '204.1': '3.0.0', '204.2': '3.0.0',
    '205.0': '3.0.0',
    '206.1': '3.0.0', '206.1.1': '3.0.0', '206.2': '3.0.0',
    '207.0': '3.0.0',
    '208.0': '3.0.0',
    '209.1': '3.0.0', '209.2': '3.0.0',
    '210.0': '3.0.0',
    '211.0': '3.0.0',
    '300.0': '3.0.0',
    '400.0': '3.0.0',
    '0000': '3.0.0',
};

// ═══════════════════════════════════════════════════════════════
// PROVIDER NAME CLEANING ENGINE
// ═══════════════════════════════════════════════════════════════

// Known system prefixes to strip (Pleo card transactions, Square, Toast, etc.)
const SYSTEM_PREFIXES = [
    /^SQ\s*\*/i,           // Square: "SQ *ROCKY ICE CREAM"
    /^TST\s*\*\*?TST\s*\*/i, // Double toast: "TST**TST* CVI.CHE"
    /^TST\s*\*/i,          // Toast: "TST*BOCATTO"
    /^SMP\s*\*/i,          // SumUp: "SMP*Johnny and lyle"
    /^Sum\s*\*/i,          // SumUp: "Sum*Venturelli"
    /^SumUp\s*\*/i,        // SumUp: "SumUp*Alikhani"
    /^MS\s*\*/i,           // Microsoft: "MS* THESOCIALHUB"
    /^LSP\s*\*/i,          // LSP: "LSP*LS The Ash"
    /^NYX\s*\*/i,          // NYX: "NYX*ABSERVICIOSSELECTA"
    /^BKG\s*\*/i,          // Booking: "BKG* Hotel at booking.com"
    /^TAP\s*\*/i,          // TAP: "TAP*UKETA"
    /^ZLR\s*\*/i,          // ZLR: "ZLR*Marion"
    /^BOI BOM ATAC\s*\*/i, // "BOI BOM ATAC*biobom"
    /^Boi Bom ATAC\s*\*/i,
    /^www\.amazon\.\s*\*/i, // "www.amazon.*Z17NH0J44"
    /^AMAZON MKTPL\s*\*/i, // "AMAZON MKTPL*B08ND2SB1"
    /^Amazon Makt\s+ES\s*\*/i, // "Amazon Makt ES*LV6SF1BG5"
    /^Amazon Prime\s*\*/i, // "Amazon Prime*ZP24X3LJ2"
    /^UBER\s+\*/i,         // "UBER *TRIP"
    /^UBER\s{2,}\*/i,      // "UBER   *TRIP"
    /^TMOBILE\s*\*/i,      // "TMOBILE*AUTO PAY"
];

// Known merchant name mappings (dirty → clean canonical name)
const KNOWN_MAPPINGS = {
    // Amazon variants
    'AMAZON MKTPL': 'Amazon',
    'AMAZON MAKT ES': 'Amazon',
    'AMAZON PRIME': 'Amazon',
    'WWW.AMAZON.': 'Amazon',
    'AMAZON': 'Amazon',
    'AMAZON.ES': 'Amazon',
    // Uber variants
    'UBER *TRIP': 'Uber',
    'UBER   *TRIP': 'Uber',
    'UBER *TRIP HELP,UBER,COM': 'Uber',
    'UBER': 'Uber',
    // Meta
    'META': 'Meta',
    // Pleo
    'PLEO': 'Pleo',
    'CHARGE PLEO': 'Pleo',
    'RECIB/PLEO FINANCIAL SERVICES': 'Pleo',
    // Booking
    'BKG': 'Booking.com',
    // DSD
    'DSD DIGITAL SMILE DESIGN': 'DSD Digital Smile Design',
    'DIGITAL SMILE DESIGN': 'DSD Digital Smile Design',
    'Digital Smile Design': 'DSD Digital Smile Design',
    // T-Mobile
    'TMOBILE': 'T-Mobile',
    'TMOBILE*AUTO': 'T-Mobile',
    'TMOBILE*AUTO PAY': 'T-Mobile',
    // Divvy
    'DIVVY': 'Divvy',
    // Travel Perk
    'TRAVEL PERK': 'TravelPerk',
    'Travel Perk': 'TravelPerk',
    'TRAVELPERK': 'TravelPerk',
    // Square
    'SQ': 'Square',
    // Banking transaction descriptions (not real providers)
    'DEV GC DEVOL': 'GoCardless Devolución',
    'DEV GC DEVOL.': 'GoCardless Devolución',
    'GTO GC DEVOL': 'GoCardless',
    'GTO GC DEVOL.': 'GoCardless',
    'TRANS. NOM INM': 'Transferencia Nomina',
    'TRANS. NOM INM/': 'Transferencia Nomina',
    'RECIB/TGSS': 'TGSS Seguridad Social',
    'RECIB/TGSS.': 'TGSS Seguridad Social',
    'RECIB/TGSS. COTIZACION': 'TGSS Seguridad Social',
    // WeWork / TikTok
    'WEWORK': 'WeWork',
    'WE WORK': 'WeWork',
    'TIKTOK': 'TikTok',
    'TIK TOK': 'TikTok',
    // WHSmith / GoDaddy
    'WHSMITH': 'WHSmith',
    'GODADDY': 'GoDaddy',
    // Movistar
    'MOVISTAR': 'Movistar',
    // Grenke
    'GRENKE': 'Grenke',
    // Proclinic
    'PROCLINIC': 'Proclinic',
    // Gusto
    'GUSTO': 'Gusto',
    // Intuit
    'INTUIT': 'Intuit',
    // Straumann
    'STRAUMANN': 'Straumann',
    // RCM
    'RCM': 'RCM',
    // Budget provider name (not invoice type)
    'BUDGET': 'Budget (Provider)',
};

/**
 * Clean a raw provider name from the CSV
 */
function cleanProviderName(raw) {
    if (!raw) return '';
    let name = raw.trim();

    // Remove surrounding quotes and leading newlines
    name = name.replace(/^["'\s\n\r]+|["'\s\n\r]+$/g, '');

    // Remove system prefixes (Pleo card transactions)
    for (const prefix of SYSTEM_PREFIXES) {
        if (prefix.test(name)) {
            name = name.replace(prefix, '').trim();
            break;
        }
    }

    // Remove trailing transaction IDs (alphanumeric codes after the merchant name)
    // e.g., "AMAZON MKTPL*B08ND2SB1" → after prefix strip → "B08ND2SB1" but we already stripped prefix
    // For names that are just IDs after stripping, try the known mappings first

    // Remove asterisks that remain
    name = name.replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();

    // Remove trailing alphanumeric ID-like suffixes (e.g., "B08ND2SB1", "ZP24X3LJ2")
    // Must contain at least one digit to avoid stripping real surnames like "Pemberthy"
    name = name.replace(/\s+(?=[A-Z0-9]*\d)[A-Z0-9]{8,}$/i, '').trim();

    // Remove trailing reference numbers after colons (e.g., "dev gc devol.:202412200002249")
    name = name.replace(/[:./]\s*\d{6,}\s*$/g, '').trim();

    // Remove trailing short numeric refs (e.g., "09366" at end after /: )
    name = name.replace(/[/:]+\s*\d{3,}\s*\w*$/g, '').trim();

    // Remove trailing question marks and isolated punctuation
    name = name.replace(/\s*\?+\s*$/, '').trim();

    // Check known mappings (case-insensitive)
    const upperName = name.toUpperCase();
    for (const [key, val] of Object.entries(KNOWN_MAPPINGS)) {
        if (upperName === key.toUpperCase() || upperName.startsWith(key.toUpperCase())) {
            return val;
        }
    }

    // Title Case normalization for ALL-CAPS names
    if (name === name.toUpperCase() && name.length > 3) {
        name = toTitleCase(name);
    }

    // Remove trailing legal suffixes for cleaner display
    name = name.replace(/\s*,?\s*\b(S\.?L\.?U?\.?|S\.?A\.?|Ltd\.?|Inc\.?|Corp\.?|GmbH|SRL|LLC)\s*$/i, '').trim();

    // Final cleanup
    name = name.replace(/\s+/g, ' ').trim();

    return name || raw.trim();
}

function toTitleCase(str) {
    const lowerWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'en', 'a', 'the', 'of', 'and', 'for', 'by']);
    return str.toLowerCase().split(' ').map(function (word, i) {
        if (i > 0 && lowerWords.has(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// ═══════════════════════════════════════════════════════════════
// DEDUPLICATION ENGINE (Levenshtein + Normalization)
// ═══════════════════════════════════════════════════════════════

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

function normalizeForCompare(str) {
    return str
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove accents
        .replace(/[^a-z0-9\s]/g, '')                        // remove special chars
        .replace(/\b(slu|sl|sa|ltd|inc|corp|gmbh|srl|llc)\b/g, '') // remove legal suffixes
        .replace(/\s+/g, ' ')
        .trim();
}

function similarity(a, b) {
    const na = normalizeForCompare(a);
    const nb = normalizeForCompare(b);
    if (na === nb) return 1.0;
    if (!na || !nb) return 0;
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 1.0;
    return 1 - levenshtein(na, nb) / maxLen;
}

/**
 * Deduplicate an array of cleaned provider names.
 * Returns a map: rawCleanedName → canonicalName
 */
function deduplicateProviders(cleanedNames, threshold) {
    const unique = Array.from(new Set(cleanedNames)).filter(Boolean);
    const canonical = {}; // normalized → canonical display name
    const mapping = {};   // any cleaned name → canonical display name

    // Skip dedup for very short names (articles, prepositions) - too many false positives
    const MIN_DEDUP_LENGTH = 4;
    const shortNames = unique.filter(function (n) { return n.length < MIN_DEDUP_LENGTH; });
    const dedupCandidates = unique.filter(function (n) { return n.length >= MIN_DEDUP_LENGTH; });

    // Short names map to themselves (no dedup)
    for (const sn of shortNames) {
        mapping[sn] = sn;
    }

    // Sort by length descending (longest = most complete = canonical)
    dedupCandidates.sort(function (a, b) { return b.length - a.length; });

    const assigned = new Set();
    const groups = [];

    for (let i = 0; i < dedupCandidates.length; i++) {
        if (assigned.has(dedupCandidates[i])) continue;
        const group = [dedupCandidates[i]];
        assigned.add(dedupCandidates[i]);

        for (let j = i + 1; j < dedupCandidates.length; j++) {
            if (assigned.has(dedupCandidates[j])) continue;
            const sim = similarity(dedupCandidates[i], dedupCandidates[j]);
            if (sim >= threshold) {
                group.push(dedupCandidates[j]);
                assigned.add(dedupCandidates[j]);
            }
        }

        // The first (longest) name is canonical
        const canonicalName = group[0];
        for (const name of group) {
            mapping[name] = canonicalName;
        }

        if (group.length > 1) {
            groups.push({ canonical: canonicalName, variants: group.slice(1) });
        }
    }

    return { mapping, groups };
}

// ═══════════════════════════════════════════════════════════════
// PROVIDER CODE GENERATION
// ═══════════════════════════════════════════════════════════════

function generateProviderCode(name) {
    // Create a slug-like code: uppercase, alphanumeric + hyphens, max 30 chars
    let code = name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
    return code || 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════
// CSV PARSING
// ═══════════════════════════════════════════════════════════════

function parseEuropeanNumber(str) {
    if (!str) return 0;
    const cleaned = str.trim().replace(/\./g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
}

function parseDate(dateStr) {
    // DD/MM/YYYY → YYYY-MM-DD
    if (!dateStr) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return year + '-' + month + '-' + day;
}

function extractFACode(subGroup) {
    // "   202.3 - Labour Planning Center" → "202.3"
    if (!subGroup) return null;
    const match = subGroup.trim().match(/^(\d+(?:\.\d+(?:\.\d+)?)?)/);
    return match ? match[1] : null;
}

function parseCsvLine(line) {
    // Simple semicolon split - no quoted fields with semicolons in this CSV
    return line.split(';');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);
    const applyMode = args.includes('--apply');
    const skipDelete = args.includes('--skip-delete');

    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║  Import Expenses → Accounts Payable                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('Mode:', applyMode ? '🔴 APPLY (will modify database)' : '🟢 DRY-RUN (preview only)');
    console.log('Similarity threshold:', (SIMILARITY_THRESHOLD * 100).toFixed(0) + '%');
    console.log('');

    // ── 1. Read CSV ──────────────────────────────────────────────
    if (!fs.existsSync(CSV_PATH)) {
        console.error('❌ CSV not found:', CSV_PATH);
        process.exit(1);
    }

    const raw = fs.readFileSync(CSV_PATH, 'utf-8');
    const content = raw.replace(/^\uFEFF/, ''); // Remove BOM
    const lines = content.split('\r\n').filter(function (l) { return l.trim(); });

    console.log('📄 CSV loaded:', lines.length - 1, 'data rows');
    console.log('   Header:', lines[0]);
    console.log('');

    // ── 2. Parse rows ────────────────────────────────────────────
    const rows = [];
    const rawProviderNames = [];
    let parseErrors = 0;

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const group = (cols[0] || '').trim();

        if (!GROUP_MAP[group]) {
            parseErrors++;
            continue;
        }

        const subGroup = (cols[1] || '').trim();
        const faCode = extractFACode(subGroup);
        const amount = parseEuropeanNumber(cols[2]);
        const invoiceDate = parseDate((cols[3] || '').trim());
        const benefitDate = parseDate((cols[4] || '').trim());
        const rawProvider = (cols[5] || '').trim();
        const description = (cols[6] || '').trim();
        const course = (cols[7] || '').trim();
        const invoiceNo = (cols[8] || '').trim();
        const currency = (cols[9] || '').trim().toUpperCase() || 'EUR';

        if (!invoiceDate) {
            parseErrors++;
            continue;
        }

        rawProviderNames.push(rawProvider);

        rows.push({
            group, subGroup, faCode, amount, invoiceDate, benefitDate,
            rawProvider, description, course, invoiceNo, currency,
            lineNumber: i + 1,
        });
    }

    console.log('📊 Parsed:', rows.length, 'valid rows,', parseErrors, 'skipped');
    console.log('   Incurred:', rows.filter(function (r) { return r.group === 'Incurred'; }).length);
    console.log('   Budget:', rows.filter(function (r) { return r.group === 'Budget'; }).length);
    console.log('   Balance Adj:', rows.filter(function (r) { return r.group === 'Balance Adjustment'; }).length);
    console.log('');

    // ── 3. Clean provider names ──────────────────────────────────
    console.log('🧹 Cleaning provider names...');
    const cleanedMap = {}; // raw → cleaned
    for (const raw of rawProviderNames) {
        if (!cleanedMap.hasOwnProperty(raw)) {
            cleanedMap[raw] = cleanProviderName(raw);
        }
    }

    const uniqueRaw = Object.keys(cleanedMap).length;
    const uniqueCleaned = new Set(Object.values(cleanedMap)).size;
    console.log('   Raw unique names:', uniqueRaw);
    console.log('   After cleaning:', uniqueCleaned);
    console.log('');

    // Show cleaning examples
    console.log('   📝 Cleaning examples:');
    let examples = 0;
    for (const [raw, clean] of Object.entries(cleanedMap)) {
        if (raw !== clean && raw && examples < 15) {
            console.log('      "' + raw + '" → "' + clean + '"');
            examples++;
        }
    }
    console.log('');

    // ── 4. Deduplicate provider names ────────────────────────────
    console.log('🔍 Deduplicating providers (threshold: ' + (SIMILARITY_THRESHOLD * 100) + '%)...');
    const allCleanedNames = Object.values(cleanedMap).filter(Boolean);
    const { mapping: dedupeMapping, groups: dedupeGroups } = deduplicateProviders(allCleanedNames, SIMILARITY_THRESHOLD);

    console.log('   Found', dedupeGroups.length, 'groups of similar names:');
    for (const g of dedupeGroups) {
        console.log('');
        console.log('   ✅ KEEP: "' + g.canonical + '"');
        for (const v of g.variants) {
            console.log('   ❌ MERGE: "' + v + '" (' + (similarity(g.canonical, v) * 100).toFixed(0) + '%)');
        }
    }

    // Build final mapping: raw → canonical
    const finalMapping = {}; // raw provider name → canonical name
    for (const [raw, cleaned] of Object.entries(cleanedMap)) {
        finalMapping[raw] = dedupeMapping[cleaned] || cleaned;
    }

    const finalUniqueProviders = new Set(Object.values(finalMapping).filter(Boolean));
    console.log('');
    console.log('   Final unique providers:', finalUniqueProviders.size);
    console.log('');

    // ── 5. Load existing providers from DB ───────────────────────
    console.log('📦 Loading existing providers from database...');
    const { data: existingProviders, error: provErr } = await supabase
        .from('providers')
        .select('code, name, is_active');

    if (provErr) {
        console.error('❌ Error loading providers:', provErr.message);
        process.exit(1);
    }

    console.log('   Existing providers in DB:', existingProviders.length);

    // Build lookup: normalized name → existing provider
    const existingByNorm = {};
    for (const p of existingProviders) {
        existingByNorm[normalizeForCompare(p.name)] = p;
    }

    // Match new providers to existing ones
    const providerCodeMap = {}; // canonicalName → code
    const newProviders = [];    // providers to insert
    let matchedExisting = 0;

    for (const canonicalName of finalUniqueProviders) {
        if (!canonicalName) continue;

        const norm = normalizeForCompare(canonicalName);

        // Exact normalized match
        if (existingByNorm[norm]) {
            providerCodeMap[canonicalName] = existingByNorm[norm].code;
            matchedExisting++;
            continue;
        }

        // Fuzzy match against existing providers
        let bestMatch = null;
        let bestSim = 0;
        for (const p of existingProviders) {
            const sim = similarity(canonicalName, p.name);
            if (sim > bestSim && sim >= SIMILARITY_THRESHOLD) {
                bestSim = sim;
                bestMatch = p;
            }
        }

        if (bestMatch) {
            providerCodeMap[canonicalName] = bestMatch.code;
            matchedExisting++;
            continue;
        }

        // New provider - generate code
        let code = generateProviderCode(canonicalName);

        // Ensure unique code
        const existingCodes = new Set(existingProviders.map(function (p) { return p.code; }));
        const newCodes = new Set(newProviders.map(function (p) { return p.code; }));
        let baseCode = code;
        let suffix = 2;
        while (existingCodes.has(code) || newCodes.has(code)) {
            code = baseCode.substring(0, 27) + '-' + suffix;
            suffix++;
        }

        providerCodeMap[canonicalName] = code;
        newProviders.push({
            code: code,
            name: canonicalName,
            provider_type: 'professional_services',
            country: 'ES',
            currency: 'EUR',
            payment_terms: 'net_30',
            is_active: true,
        });
    }

    console.log('   Matched to existing:', matchedExisting);
    console.log('   New providers to create:', newProviders.length);
    console.log('');

    if (newProviders.length > 0) {
        console.log('   📝 Sample new providers (first 20):');
        newProviders.slice(0, 20).forEach(function (p) {
            console.log('      [' + p.code + '] ' + p.name);
        });
        console.log('');
    }

    // ── 6. Prepare invoices ──────────────────────────────────────
    console.log('📋 Preparing invoices...');

    // Load existing FA codes for validation
    const { data: faList } = await supabase.from('financial_accounts').select('code').eq('is_active', true);
    const validFACodes = new Set((faList || []).map(function (f) { return f.code; }));

    const invoices = [];
    let missingFA = 0;
    let missingProvider = 0;

    // Invoice number counter per scope-month
    const invoiceCounters = {};

    for (const row of rows) {
        const canonicalProvider = finalMapping[row.rawProvider] || '';
        const providerCode = providerCodeMap[canonicalProvider];

        if (!providerCode && canonicalProvider) {
            missingProvider++;
            continue;
        }

        // Determine country/scope from currency
        const isUS = row.currency === 'USD';
        const scope = isUS ? 'US' : 'ES';
        const countryCode = scope;

        // FA code
        let faCode = row.faCode;
        if (faCode && !validFACodes.has(faCode)) {
            // Try without trailing zero
            if (validFACodes.has(faCode + '.0')) faCode = faCode + '.0';
        }
        // If still no valid FA, use the raw code and let DB handle it
        if (!faCode) faCode = '210.0'; // Miscellaneous fallback

        // Cost mappings
        const faPrefix = faCode ? faCode.split('.')[0] : '210';
        const depCostType = FA_TO_DEP_COST_TYPE[faPrefix] || 'GENEXP';
        const costType = FA_TO_COST_TYPE[faPrefix] || 'VARIABLE';
        const costCenter = FA_TO_COST_CENTER[faCode] || FA_TO_COST_CENTER[faCode.split('.').slice(0, 2).join('.')] || '3.0.0';

        // Invoice number
        const month = row.invoiceDate.substring(0, 7).replace('-', ''); // YYYYMM
        const counterKey = scope + '-' + month;
        invoiceCounters[counterKey] = (invoiceCounters[counterKey] || 0) + 1;
        const seqNum = invoiceCounters[counterKey].toString().padStart(4, '0');
        const invoiceNumber = scope + '-INV-' + month + '-' + seqNum;

        // DRE and cash impact by invoice type
        const invoiceType = GROUP_MAP[row.group];
        const isBudget = invoiceType === 'BUDGET';
        const isAdjustment = invoiceType === 'ADJUSTMENT';
        const dreImpact = !isAdjustment;
        const cashImpact = !isBudget;

        invoices.push({
            invoice_date: row.invoiceDate,
            benefit_date: row.benefitDate || row.invoiceDate,
            due_date: row.invoiceDate,
            schedule_date: row.invoiceDate,
            invoice_type: invoiceType,
            entry_type: ENTRY_TYPE_MAP[row.group] || 'INCURRED',
            financial_account_code: faCode,
            financial_account_name: row.subGroup,
            invoice_amount: Math.abs(row.amount),
            currency: row.currency || 'EUR',
            eur_exchange: row.currency === 'EUR' ? 1.0 : 1.0,
            provider_code: providerCode || 'UNKNOWN',
            cost_type_code: costType,
            dep_cost_type_code: depCostType,
            cost_center_code: costCenter,
            description: row.description || '',
            invoice_number: invoiceNumber,
            country_code: countryCode,
            scope: scope,
            dre_impact: dreImpact,
            cash_impact: cashImpact,
            is_reconciled: false,
            payment_status: 'pending',
            invoice_status: 'pending',
            finance_payment_status: 'pending',
            notes: row.course ? ('Course: ' + row.course) : null,
        });
    }

    console.log('   Invoices prepared:', invoices.length);
    console.log('   Missing provider:', missingProvider);
    console.log('   Missing FA:', missingFA);
    console.log('');

    // Currency breakdown
    const byCurrency = {};
    invoices.forEach(function (inv) {
        byCurrency[inv.currency] = (byCurrency[inv.currency] || 0) + 1;
    });
    console.log('   By currency:', JSON.stringify(byCurrency));

    // Type breakdown
    const byType = {};
    invoices.forEach(function (inv) {
        byType[inv.invoice_type] = (byType[inv.invoice_type] || 0) + 1;
    });
    console.log('   By type:', JSON.stringify(byType));

    // Total amount
    const totalAmount = invoices.reduce(function (sum, inv) { return sum + inv.invoice_amount; }, 0);
    console.log('   Total amount: €' + totalAmount.toLocaleString('de-DE', { minimumFractionDigits: 2 }));
    console.log('');

    // ── 7. Execute changes ───────────────────────────────────────
    if (!applyMode) {
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('  🟢 DRY RUN COMPLETE — No changes made.');
        console.log('  Run with --apply to execute.');
        console.log('  Example: node scripts/import-expenses-ap.js --apply');
        console.log('═══════════════════════════════════════════════════════════════');
        return;
    }

    console.log('🔴 APPLYING CHANGES...');
    console.log('');

    // ── 7a. Delete existing manual invoices ──────────────────────
    if (!skipDelete) {
        console.log('🗑️  Step 1: Deleting existing manual invoices...');

        // Delete all invoices that are NOT BOT-*
        const { data: manualInvoices, error: fetchErr } = await supabase
            .from('invoices')
            .select('id, invoice_number')
            .not('invoice_number', 'like', 'BOT-%');

        if (fetchErr) {
            console.error('❌ Error fetching manual invoices:', fetchErr.message);
            process.exit(1);
        }

        if (manualInvoices && manualInvoices.length > 0) {
            const ids = manualInvoices.map(function (inv) { return inv.id; });
            console.log('   Found', ids.length, 'manual invoices to delete');

            // Delete in batches
            for (let i = 0; i < ids.length; i += BATCH_SIZE) {
                const batch = ids.slice(i, i + BATCH_SIZE);
                const { error: delErr } = await supabase
                    .from('invoices')
                    .delete()
                    .in('id', batch);

                if (delErr) {
                    console.error('   ❌ Error deleting batch:', delErr.message);
                } else {
                    console.log('   ✅ Deleted batch', Math.floor(i / BATCH_SIZE) + 1, '(' + batch.length + ' rows)');
                }
            }
        } else {
            console.log('   No manual invoices to delete.');
        }
        console.log('');
    }

    // ── 7b. Insert new providers ─────────────────────────────────
    console.log('👥 Step 2: Inserting new providers...');

    if (newProviders.length > 0) {
        for (let i = 0; i < newProviders.length; i += BATCH_SIZE) {
            const batch = newProviders.slice(i, i + BATCH_SIZE);
            const { error: insErr } = await supabase
                .from('providers')
                .upsert(batch, { onConflict: 'code' });

            if (insErr) {
                console.error('   ❌ Error inserting providers batch:', insErr.message);
            } else {
                console.log('   ✅ Inserted batch', Math.floor(i / BATCH_SIZE) + 1, '(' + batch.length + ' providers)');
            }
        }
    } else {
        console.log('   No new providers to insert.');
    }
    console.log('');

    // ── 7c. Ensure financial account codes exist ─────────────────
    console.log('📊 Step 3: Ensuring financial account codes exist...');

    const neededFACodes = new Set(invoices.map(function (inv) { return inv.financial_account_code; }));
    const missingFACodes = [];
    for (const code of neededFACodes) {
        if (!validFACodes.has(code)) {
            missingFACodes.push(code);
        }
    }

    if (missingFACodes.length > 0) {
        console.log('   Creating', missingFACodes.length, 'missing FA codes...');
        const faInserts = missingFACodes.map(function (code) {
            // Find the name from our rows
            const sampleRow = rows.find(function (r) { return r.faCode === code; });
            return {
                code: code,
                name: code + ' - ' + (sampleRow ? sampleRow.subGroup.replace(/^\s*[\d.]+\s*-\s*/, '') : 'Unknown'),
                type: 'expense',
                level: code.split('.').length - 1,
                parent_code: code.split('.').slice(0, -1).join('.') + '.0',
                is_active: true,
                country_code: 'ES',
                applies_to_all_countries: true,
            };
        });

        const { error: faErr } = await supabase
            .from('financial_accounts')
            .upsert(faInserts, { onConflict: 'code' });

        if (faErr) {
            console.error('   ⚠️  Error creating FA codes (continuing):', faErr.message);
        } else {
            console.log('   ✅ Created', faInserts.length, 'financial account codes');
        }
    } else {
        console.log('   All FA codes exist.');
    }
    console.log('');

    // ── 7d. Insert invoices ──────────────────────────────────────
    console.log('📥 Step 4: Inserting', invoices.length, 'invoices...');

    let insertedCount = 0;
    let insertErrors = 0;

    for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
        const batch = invoices.slice(i, i + BATCH_SIZE);
        const { data: inserted, error: insErr } = await supabase
            .from('invoices')
            .insert(batch)
            .select('id');

        if (insErr) {
            console.error('   ❌ Error inserting batch', Math.floor(i / BATCH_SIZE) + 1 + ':', insErr.message);
            // Try to identify the problematic row
            if (batch.length > 1) {
                console.log('   Retrying one-by-one...');
                for (const inv of batch) {
                    const { error: singleErr } = await supabase.from('invoices').insert([inv]);
                    if (singleErr) {
                        insertErrors++;
                        if (insertErrors <= 5) {
                            console.error('   ❌ Row failed:', inv.invoice_number, '-', singleErr.message);
                        }
                    } else {
                        insertedCount++;
                    }
                }
            } else {
                insertErrors += batch.length;
            }
        } else {
            insertedCount += (inserted ? inserted.length : batch.length);
            if ((Math.floor(i / BATCH_SIZE) + 1) % 10 === 0 || i + BATCH_SIZE >= invoices.length) {
                console.log('   ✅ Progress:', insertedCount, '/', invoices.length, '(' + Math.round(insertedCount / invoices.length * 100) + '%)');
            }
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  ✅ IMPORT COMPLETE');
    console.log('  Providers created:', newProviders.length);
    console.log('  Invoices inserted:', insertedCount);
    console.log('  Insert errors:', insertErrors);
    console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(function (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
