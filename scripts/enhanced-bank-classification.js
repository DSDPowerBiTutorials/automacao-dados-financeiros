/**
 * ENHANCED DEEP BANK RECONCILIATION + P&L CLASSIFICATION
 * 
 * Phase 1: Match more bank→gateway (AmEx, GC, Stripe by amount/date)
 * Phase 2: Tag bank rows with paymentSource from description patterns
 * Phase 3: For bank rows with paymentSource but no tx_ids, try direct customer→P&L
 * Phase 4: For direct transfers (Transf/NAME), match to IO customer → P&L
 * 
 * Stores: custom_data.pnl_line, custom_data.pnl_classification_method
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://rrzgawssbyfzbkmtcovz.supabase.co',
  'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

const DRY_RUN = process.argv.includes('--dry-run');

async function paginate(source) {
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await supabase.from('csv_rows')
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

function daysDiff(d1, d2) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
}

async function batchUpdate(updates) {
  if (DRY_RUN) return updates.length;
  let success = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    const results = await Promise.allSettled(batch.map(async u => {
      const { data: existing } = await supabase.from('csv_rows')
        .select('custom_data').eq('id', u.id).single();
      const merged = { ...(existing?.custom_data || {}), ...u.fields };
      const updateObj = { custom_data: merged };
      if (u.setPaymentSource) {
        // Also update reconciled + paymentSource in custom_data
        merged.paymentSource = u.setPaymentSource;
      }
      if (u.setReconciled) {
        updateObj.reconciled = true;
      }
      const { error } = await supabase.from('csv_rows').update(updateObj).eq('id', u.id);
      if (error) throw new Error(`${u.id}: ${error.message}`);
      return true;
    }));
    success += results.filter(r => r.status === 'fulfilled').length;
  }
  return success;
}

(async () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   ENHANCED BANK CLASSIFICATION & RECONCILIATION ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // === LOAD DATA ===
  console.log('[1/5] Loading data...');
  const be = (await paginate('bankinter-eur')).filter(r => r.amount > 0);
  const cu = (await paginate('chase-usd')).filter(r => r.amount > 0);
  const bankAll = [...be, ...cu];
  const noPS = bankAll.filter(r => !r.custom_data?.paymentSource);
  const withPS = bankAll.filter(r => r.custom_data?.paymentSource);

  // Load gateway data
  const btAmex = await paginate('braintree-amex');
  const gc = await paginate('gocardless');
  const stripeEur = await paginate('stripe-eur');
  const stripeUsd = await paginate('stripe-usd');
  const io = await paginate('invoice-orders');

  console.log(`  Bank inflows: ${bankAll.length} (${withPS.length} with PS, ${noPS.length} without)`);
  console.log(`  BT-Amex: ${btAmex.length}, GC: ${gc.length}, Stripe: ${stripeEur.length + stripeUsd.length}`);
  console.log(`  Invoice-orders: ${io.length}`);

  // Build IO lookup maps
  const ioByName = {};
  const customerFAC = {}; // name → { facCode: count }
  io.forEach(r => {
    const name = normalize(r.custom_data?.customer_name);
    const fac = r.custom_data?.financial_account_code;
    if (name && name.length >= 3) {
      if (!ioByName[name]) ioByName[name] = [];
      ioByName[name].push(r);
      if (fac) {
        if (!customerFAC[name]) customerFAC[name] = {};
        customerFAC[name][fac] = (customerFAC[name][fac] || 0) + 1;
      }
    }
  });

  // Helper: get most common FAC for a customer
  function getMostCommonFAC(name) {
    const facs = customerFAC[normalize(name)];
    if (!facs) return null;
    let best = null, bestCount = 0;
    for (const [fac, count] of Object.entries(facs)) {
      if (count > bestCount) { best = fac; bestCount = count; }
    }
    return best;
  }

  // Helper: get prefix P&L code
  function getPnlLine(facCode) {
    if (!facCode) return null;
    return facCode.split('.')[0] || null;
  }

  // === PHASE 1: AmEx bank → BT-Amex disbursement matching ===
  console.log('\n[2/5] Phase 1: AmEx deep matching...');

  // Build AmEx disbursement groups
  const amexByDisb = {};
  btAmex.filter(r => r.custom_data?.disbursement_date).forEach(r => {
    const dd = r.custom_data.disbursement_date.split('T')[0];
    const merchant = r.custom_data?.merchant_account_id || 'unknown';
    const key = `${dd}|${merchant}`;
    if (!amexByDisb[key]) amexByDisb[key] = { amount: 0, count: 0, txIds: [], customers: [] };
    amexByDisb[key].amount += parseFloat(r.custom_data?.settlement_amount || r.amount || 0);
    amexByDisb[key].count++;
    const txId = r.custom_data?.transaction_id;
    if (txId) amexByDisb[key].txIds.push(txId);
    const name = r.custom_data?.customer_name;
    if (name && !amexByDisb[key].customers.includes(name)) amexByDisb[key].customers.push(name);
  });

  const amexUpdates = [];
  const amexBankRows = noPS.filter(r => {
    const d = r.description.toLowerCase();
    return d.includes('american express') || d.includes('amex');
  });

  amexBankRows.forEach(bank => {
    const bankAmt = parseFloat(bank.amount);
    let best = null, bestDiff = Infinity;

    for (const [key, group] of Object.entries(amexByDisb)) {
      const [date] = key.split('|');
      const days = daysDiff(bank.date, date);
      // AmEx typically pays 3-5 days after disbursement
      if (days > 7) continue;

      const diff = Math.abs(group.amount - bankAmt);
      const tolerance = Math.max(bankAmt * 0.03, 5); // 3% or €5
      if (diff <= tolerance && diff < bestDiff) {
        bestDiff = diff;
        best = { ...group, date };
      }
    }

    if (best) {
      amexUpdates.push({
        id: bank.id,
        setPaymentSource: 'braintree (amex)',
        setReconciled: true,
        fields: {
          paymentSource: 'braintree (amex)',
          reconciliationType: 'amex-disbursement-match',
          transaction_ids: best.txIds,
          matched_customers: best.customers,
          reconciled_at: new Date().toISOString()
        }
      });
    }
  });
  console.log(`  AmEx bank→BT-Amex: ${amexUpdates.length} / ${amexBankRows.length} matched`);

  // === PHASE 2: GC bank → GC payout matching ===
  console.log('\n[3/5] Phase 2: GoCardless matching...');
  const gcPayouts = gc.filter(r => r.custom_data?.type === 'payout');
  const gcPayments = gc.filter(r => r.custom_data?.type !== 'payout');

  const gcBankRows = noPS.filter(r => r.description.toLowerCase().includes('gocardless'));
  const gcUpdates = [];
  const usedGC = new Set();

  // Strategy 1: Exact amount ±€1, ±5 days
  gcBankRows.forEach(bank => {
    const bankAmt = parseFloat(bank.amount);
    let best = null, bestDays = Infinity;

    for (const gc of gcPayouts) {
      if (usedGC.has(gc.id)) continue;
      const gcAmt = Math.abs(parseFloat(gc.amount));
      const days = daysDiff(bank.date, gc.date);
      if (days <= 5 && Math.abs(gcAmt - bankAmt) <= 1 && days < bestDays) {
        bestDays = days;
        best = gc;
      }
    }

    if (best) {
      usedGC.add(best.id);
      gcUpdates.push({
        id: bank.id,
        setPaymentSource: 'gocardless',
        setReconciled: true,
        fields: {
          paymentSource: 'gocardless',
          reconciliationType: 'gocardless-payout-match',
          transaction_ids: [best.custom_data?.payout_id || best.id],
          reconciled_at: new Date().toISOString()
        }
      });
    }
  });

  // Strategy 2: Sum of GC payouts in date range ±5 days (greedy)
  gcBankRows.forEach(bank => {
    if (gcUpdates.find(u => u.id === bank.id)) return;
    const bankAmt = parseFloat(bank.amount);

    // Find GC payouts within date range
    const candidates = gcPayouts.filter(gc => {
      if (usedGC.has(gc.id)) return false;
      return daysDiff(bank.date, gc.date) <= 5;
    });

    if (candidates.length === 0) return;

    // Try sum matching
    const totalGC = candidates.reduce((s, gc) => s + Math.abs(parseFloat(gc.amount)), 0);
    if (Math.abs(totalGC - bankAmt) <= Math.max(bankAmt * 0.02, 2)) {
      candidates.forEach(gc => usedGC.add(gc.id));
      gcUpdates.push({
        id: bank.id,
        setPaymentSource: 'gocardless',
        setReconciled: true,
        fields: {
          paymentSource: 'gocardless',
          reconciliationType: 'gocardless-sum-match',
          transaction_ids: candidates.map(gc => gc.custom_data?.payout_id || gc.id),
          reconciled_at: new Date().toISOString()
        }
      });
    }
  });
  console.log(`  GC bank→payout: ${gcUpdates.length} / ${gcBankRows.length} matched`);

  // === PHASE 3: Tag remaining by description pattern ===
  console.log('\n[4/5] Phase 3: Description-based tagging...');
  const tagUpdates = [];
  const alreadyHandled = new Set([
    ...amexUpdates.map(u => u.id),
    ...gcUpdates.map(u => u.id)
  ]);

  noPS.forEach(r => {
    if (alreadyHandled.has(r.id)) return;
    const desc = r.description.toLowerCase();
    let tag = null;

    if (desc.includes('paypal')) tag = 'paypal';
    else if (desc.includes('stripe')) tag = 'stripe';
    else if (desc.includes('gocardless') || desc.includes('go cardless')) tag = 'gocardless';
    else if (desc.includes('american express') || desc.includes('amex')) tag = 'braintree (amex)';
    else if (desc.includes('braintree')) tag = 'braintree';

    if (tag) {
      tagUpdates.push({
        id: r.id,
        setPaymentSource: tag,
        fields: {
          paymentSource: tag,
          tagged_from: 'description-pattern',
          tagged_at: new Date().toISOString()
        }
      });
      alreadyHandled.add(r.id);
    }
  });
  console.log(`  Tagged from description: ${tagUpdates.length}`);

  // Tag distribution
  const tagDist = {};
  tagUpdates.forEach(u => {
    tagDist[u.setPaymentSource] = (tagDist[u.setPaymentSource] || 0) + 1;
  });
  Object.entries(tagDist).forEach(([tag, count]) => {
    console.log(`    ${tag}: ${count}`);
  });

  // === PHASE 4: Direct bank description → customer → P&L classification ===
  console.log('\n[5/5] Phase 4: Direct P&L classification...');
  const pnlUpdates = [];

  // For bank rows with transfer descriptions, extract customer name → match to IO → get P&L
  noPS.forEach(r => {
    if (alreadyHandled.has(r.id)) return;
    if (r.custom_data?.pnl_line) return; // Already classified

    const desc = r.description;
    // Extract name
    let name = null;
    let m = desc.match(/trans(?:f|\.?\s*inm)?\/(.+)/i);
    if (m) name = m[1].trim();
    if (!name) {
      m = desc.match(/^mxiso\s+(.+)/i);
      if (m) name = m[1].trim();
    }
    if (!name) return;

    // Normalize and check IO
    const norm = normalize(name);
    if (norm.length < 3) return;

    // Skip known non-customer names
    if (['paypal europe sarl', 'paypal europe s a r l', 'stripe'].some(x => norm.includes(x))) return;

    // Exact match first
    let fac = null;
    if (ioByName[norm]) {
      const withFac = ioByName[norm].filter(o => o.custom_data?.financial_account_code);
      if (withFac.length > 0) {
        fac = getMostCommonFAC(norm);
      }
    }

    // Partial match
    if (!fac) {
      for (const [ioName, ios] of Object.entries(ioByName)) {
        if (norm.includes(ioName) || ioName.includes(norm)) {
          const withFac = ios.filter(o => o.custom_data?.financial_account_code);
          if (withFac.length > 0) {
            fac = getMostCommonFAC(ioName);
            break;
          }
        }
      }
    }

    if (fac) {
      pnlUpdates.push({
        id: r.id,
        fields: {
          pnl_line: getPnlLine(fac),
          pnl_fac: fac,
          pnl_classification_method: 'bank-description-customer',
          pnl_classified_at: new Date().toISOString(),
          extracted_customer: name
        }
      });
      alreadyHandled.add(r.id);
    }
  });

  // Also try to classify intercompany DSD transfers
  noPS.forEach(r => {
    if (alreadyHandled.has(r.id)) return;
    const desc = r.description.toLowerCase();
    if (desc.includes('dsd') && (desc.includes('llc') || desc.includes('s.l') || desc.includes('planning center'))) {
      pnlUpdates.push({
        id: r.id,
        fields: {
          pnl_line: '105',
          pnl_fac: '105.0',
          pnl_classification_method: 'intercompany-dsd',
          pnl_classified_at: new Date().toISOString()
        }
      });
      alreadyHandled.add(r.id);
    }
  });

  console.log(`  Direct P&L classified: ${pnlUpdates.length}`);

  // P&L distribution
  const pnlDist = {};
  pnlUpdates.forEach(u => {
    const line = u.fields.pnl_line;
    pnlDist[line] = (pnlDist[line] || 0) + 1;
  });
  Object.entries(pnlDist).forEach(([line, count]) => {
    console.log(`    Line ${line}: ${count}`);
  });

  // === SUMMARY ===
  const allUpdates = [...amexUpdates, ...gcUpdates, ...tagUpdates, ...pnlUpdates];
  console.log('\n═══ OVERALL SUMMARY ═══');
  console.log(`  AmEx bank→BT-Amex: ${amexUpdates.length}`);
  console.log(`  GoCardless bank→payout: ${gcUpdates.length}`);
  console.log(`  Description tagging: ${tagUpdates.length}`);
  console.log(`  Direct P&L: ${pnlUpdates.length}`);
  console.log(`  Total updates: ${allUpdates.length}`);

  // Projected coverage
  const currentWithPS = withPS.length;
  const newWithPS = amexUpdates.length + gcUpdates.length + tagUpdates.length;
  console.log(`\n  Gateway coverage: ${currentWithPS} → ${currentWithPS + newWithPS} / ${bankAll.length} (${Math.round((currentWithPS + newWithPS) / bankAll.length * 100)}%)`);

  const currentPnLDirect = bankAll.filter(r => r.custom_data?.pnl_line).length;
  console.log(`  Direct P&L tags: ${currentPnLDirect} → ${currentPnLDirect + pnlUpdates.length}`);

  // === WRITE ===
  if (DRY_RUN) {
    console.log('\n  DRY RUN — no writes');
  } else if (allUpdates.length > 0) {
    console.log(`\n  Writing ${allUpdates.length} updates...`);
    const written = await batchUpdate(allUpdates);
    console.log(`  Written: ${written} / ${allUpdates.length}`);
  }

  console.log('\n✓ Done!');
  process.exit(0);
})();
