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
    const { data } = await sb.storage.from('csv_files').download('1773874686027-orders__3_.csv');
    const text = await data.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = parseCSVLine(lines[0], ',');
    const dateIdx = headers.findIndex(c => c.toLowerCase().trim() === 'dateordered');

    const counts = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i], ',');
        const raw = (cols[dateIdx] || '').replace(/\\\//g, '/');
        const m = raw.match(/date.*?(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) {
            const d = m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
            counts[d] = (counts[d] || 0) + 1;
        }
    }

    console.log('Dates in CSV (summary):');
    Object.entries(counts).sort().forEach(([d, c]) => console.log('  ' + d + ': ' + c + ' orders'));
    console.log('Total rows:', lines.length - 1);
}

main();
