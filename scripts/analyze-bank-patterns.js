// Analyze unmatched bank descriptions vs invoice-orders customer names
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  'https://rrzgawssbyfzbkmtcovz.supabase.co',
  'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source) {
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await s.from('csv_rows')
      .select('id, amount, date, description, reconciled, custom_data, source')
      .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    page++;
  }
  return all;
}

function normalize(str) {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}

function extractNameFromBankDesc(desc) {
  const d = desc.trim();
  // Pattern: "Transf/NAME" or "Trans inm/NAME" or "Trans/NAME"  
  let m = d.match(/trans(?:f|\.?\s*inm)?\/(.+)/i);
  if (m) return m[1].trim();
  // Pattern: "Mxiso NAME" (international transfer)
  m = d.match(/^mxiso\s+(.+)/i);
  if (m) return m[1].trim();
  // Wire: "originator: NAME" or like Chase "ORIG CO NAME:VALUE"
  m = d.match(/ORIG CO NAME:([^\s]+(?:\s+[^\s:]+)*?)(?:\s+ORIG ID:|$)/i);
  if (m) return m[1].trim();
  return null;
}

(async () => {
  console.log('=== BANK DESCRIPTION → CUSTOMER MATCHING ===\n');

  const be = (await paginate('bankinter-eur')).filter(r => r.amount > 0);
  const cu = (await paginate('chase-usd')).filter(r => r.amount > 0);
  const bankAll = [...be, ...cu];
  const noPS = bankAll.filter(r => !r.custom_data?.paymentSource);

  // Load IO
  const io = await paginate('invoice-orders');
  const ioNames = new Set();
  const ioByName = {};
  io.forEach(r => {
    const name = normalize(r.custom_data?.customer_name);
    if (name && name.length >= 3) {
      ioNames.add(name);
      if (!ioByName[name]) ioByName[name] = [];
      ioByName[name].push(r);
    }
  });

  console.log(`Bank inflows without gateway: ${noPS.length}`);
  console.log(`IO unique names: ${ioNames.size}\n`);

  // Try to extract customer name from bank description and match to IO
  let matched = 0;
  let extractedName = 0;
  let withFAC = 0;
  const matchedRows = [];

  noPS.forEach(r => {
    const name = extractNameFromBankDesc(r.description);
    if (!name) return;
    extractedName++;

    const normalized = normalize(name);

    // Exact match
    if (ioByName[normalized]) {
      const io = ioByName[normalized];
      const withCode = io.filter(o => o.custom_data?.financial_account_code);
      if (withCode.length > 0) {
        matched++;
        withFAC++;
        matchedRows.push({ bank: r, ioName: normalized, fac: withCode[0].custom_data.financial_account_code });
      } else {
        matched++;
      }
      return;
    }

    // Partial match: check if any IO name contains or is contained by the extracted name
    for (const ioName of ioNames) {
      if ((normalized.includes(ioName) || ioName.includes(normalized)) && normalized.length >= 5) {
        const io = ioByName[ioName];
        const withCode = io.filter(o => o.custom_data?.financial_account_code);
        if (withCode.length > 0) {
          matched++;
          withFAC++;
          matchedRows.push({ bank: r, ioName, fac: withCode[0].custom_data.financial_account_code });
        } else {
          matched++;
        }
        return;
      }
    }
  });

  console.log(`Names extracted from descriptions: ${extractedName}`);
  console.log(`Matched to IO customer: ${matched}`);
  console.log(`Matched with FAC: ${withFAC}`);
  console.log();

  // Show samples
  console.log('Sample matches:');
  matchedRows.slice(0, 15).forEach(m => {
    console.log(`  ${m.bank.description.substring(0, 60).padEnd(60)} → ${m.ioName.padEnd(25)} FAC:${m.fac}`);
  });

  // Show unextractable descriptions
  console.log('\nDescriptions where name could NOT be extracted:');
  const noName = noPS.filter(r => !extractNameFromBankDesc(r.description));
  const patterns = {};
  noName.forEach(r => {
    const desc = r.description.toLowerCase();
    let p = 'other';
    if (desc.includes('paypal')) p = 'paypal';
    else if (desc.includes('american express') || desc.includes('amex')) p = 'amex';
    else if (desc.includes('remesa') || desc.includes('abono')) p = 'remesa/abono';
    else if (desc.includes('gocardless')) p = 'gocardless';
    else if (desc.includes('stripe')) p = 'stripe';
    else if (desc.includes('dsd')) p = 'dsd/intercompany';
    patterns[p] = (patterns[p] || 0) + 1;
  });
  console.log(`  Total with no name: ${noName.length}`);
  Object.entries(patterns).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log(`    ${p}: ${c}`);
  });

  // Analyze PayPal: can we link PayPal to BT?
  console.log('\n=== PAYPAL ANALYSIS ===');
  const paypalBank = noPS.filter(r => r.description.toLowerCase().includes('paypal'));
  console.log(`PayPal bank rows: ${paypalBank.length}`);
  console.log('PayPal amounts sample:');
  paypalBank.slice(0, 10).forEach(r => {
    console.log(`  ${r.date} | ${r.amount.toFixed(2)} | ${r.description.substring(0, 60)}`);
  });

  // Analyze AmEx: can we link AmEx bank rows to braintree-amex?
  console.log('\n=== AMEX ANALYSIS ===');
  const amexBank = noPS.filter(r => {
    const d = r.description.toLowerCase();
    return d.includes('american express') || d.includes('amex');
  });
  console.log(`AmEx bank rows: ${amexBank.length}`);
  console.log('AmEx amounts sample:');
  amexBank.slice(0, 10).forEach(r => {
    console.log(`  ${r.date} | ${r.amount.toFixed(2)} | ${r.description.substring(0, 60)}`);
  });

  // Can we match AmEx bank amounts to BT-Amex disbursement groups?
  const btAmex = await paginate('braintree-amex');
  console.log(`BT-Amex rows total: ${btAmex.length}`);
  const btAmexWithDisb = btAmex.filter(r => r.custom_data?.disbursement_date);
  console.log(`BT-Amex with disbursement_date: ${btAmexWithDisb.length}`);

  // Group BT-Amex by disbursement_date
  const amexByDisb = {};
  btAmexWithDisb.forEach(r => {
    const dd = r.custom_data.disbursement_date.split('T')[0];
    if (!amexByDisb[dd]) amexByDisb[dd] = { amount: 0, count: 0 };
    amexByDisb[dd].amount += parseFloat(r.amount) || 0;
    amexByDisb[dd].count++;
  });

  console.log(`\nBT-Amex disbursement groups: ${Object.keys(amexByDisb).length}`);

  // Try to match AmEx bank rows to BT-Amex disbursement sums
  let amexMatched = 0;
  amexBank.forEach(bank => {
    const bankAmt = parseFloat(bank.amount);
    // Check all disbursement dates within ±5 days
    for (const [date, group] of Object.entries(amexByDisb)) {
      const days = Math.abs(new Date(bank.date).getTime() - new Date(date).getTime()) / 86400000;
      if (days <= 5 && Math.abs(group.amount - bankAmt) < bankAmt * 0.05) {
        amexMatched++;
        break;
      }
    }
  });
  console.log(`AmEx bank→BT-Amex disbursement matches: ${amexMatched} / ${amexBank.length}`);

  // GoCardless bank analysis
  console.log('\n=== GOCARDLESS BANK ANALYSIS ===');
  const gcBank = noPS.filter(r => r.description.toLowerCase().includes('gocardless'));
  console.log(`GoCardless bank rows: ${gcBank.length}`);

  const gcPayouts = (await paginate('gocardless')).filter(r => r.custom_data?.type === 'payout');
  console.log(`GoCardless payout rows: ${gcPayouts.length}`);

  // Try to match
  let gcMatched = 0;
  gcBank.forEach(bank => {
    const bankAmt = parseFloat(bank.amount);
    for (const gc of gcPayouts) {
      const gcAmt = parseFloat(gc.amount);
      const days = Math.abs(new Date(bank.date).getTime() - new Date(gc.date).getTime()) / 86400000;
      if (days <= 5 && Math.abs(gcAmt - bankAmt) < Math.max(1, bankAmt * 0.02)) {
        gcMatched++;
        break;
      }
    }
  });
  console.log(`GoCardless bank→payout matches: ${gcMatched} / ${gcBank.length}`);

  process.exit(0);
})();
