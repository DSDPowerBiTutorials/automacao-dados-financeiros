require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function parseCSVLine(line, sep) {
    const result = [];
    let current = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { current += '"'; i++; }
            else { inQ = !inQ; }
        } else if (ch === sep && !inQ) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

async function main() {
    const { data, error } = await sb.storage.from('csv_files').download('1773874686027-orders__3_.csv');
    if (error) { console.error(error); return; }
    const text = await data.text();
    const lines = text.split('\n').filter(l => l.trim());

    const headers = parseCSVLine(lines[0], ',');
    const dateIdx = headers.findIndex(c => c.toLowerCase().trim() === 'dateordered');
    console.log('dateOrdered index:', dateIdx);

    // Show raw values of first 10 rows
    console.log('\n=== Raw dateOrdered values (first 10 rows) ===');
    for (let i = 1; i <= Math.min(10, lines.length - 1); i++) {
        const cols = parseCSVLine(lines[i], ',');
        console.log('Row', i, ':', JSON.stringify((cols[dateIdx] || '').substring(0, 120)));
    }

    // Collect all unique dates
    const dateCounts = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], ',');
        const raw = cols[dateIdx] || '';
        // JSON format: {"date":"M/D/YYYY",...}
        const m = raw.match(/date["']?\s*:\s*["']?(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (m) {
            dateCounts[m[1]] = (dateCounts[m[1]] || 0) + 1;
        } else if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) {
            const d = raw.trim().substring(0, 10);
            dateCounts[d] = (dateCounts[d] || 0) + 1;
        } else if (raw.trim()) {
            dateCounts['UNPARSED: ' + raw.substring(0, 80)] = 1;
        }
    }

    console.log('\n=== All unique dates with counts ===');
    Object.entries(dateCounts).sort().forEach(([d, c]) => console.log(c + 'x', d));

    // Now check what parseCraftDate produces
    console.log('\n=== parseCraftDate output for each row ===');
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], ',');
        const raw = cols[dateIdx] || '';
        const parsed = parseCraftDate(raw);
        const orderNum = cols[0] || '';
        console.log('Order', orderNum, '| raw date:', raw.substring(0, 60), '| parsed:', parsed);
    }
}

function parseCraftDate(dateStr) {
    if (!dateStr || dateStr.trim() === '' || dateStr.trim() === '-') return null;
    const trimmed = dateStr.replace(/["\t\\]/g, '').trim();
    const jsonMatch = trimmed.match(/date\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (jsonMatch) {
        const [, month, day, year] = jsonMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        return trimmed.substring(0, 10);
    }
    return null;
}

main();
