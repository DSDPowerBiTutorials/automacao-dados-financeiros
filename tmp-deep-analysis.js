// Deep reconciliation analysis - testing matching strategies
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
    'https://rrzgawssbyfzbkmtcovz.supabase.co',
    'sb_secret_d5XN1_EVZod7kJJCRZpXmw_ncDkXEoY'
);

async function paginate(source, fields) {
    let all = [];
    let page = 0;
    while (true) {
        const { data } = await s.from('csv_rows').select(fields || 'id, amount, date, description, reconciled, custom_data')
            .eq('source', source).range(page * 1000, (page + 1) * 1000 - 1);
        if (data === null || data.length === 0) break;
        all.push(...data);
        page++;
        if (page > 50) break;
    }
    return all;
}

function normalize(str) {
    if (!str) return '';
    return str.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 ]/g, '')
        .trim();
}

(async () => {
    console.log('=== DEEP RECONCILIATION GAP ANALYSIS ===\n');

    // Load all data
    const btRev = await paginate('braintree-api-revenue');
    const btAmex = await paginate('braintree-amex');
    const io = await paginate('invoice-orders');
    const bankEur = (await paginate('bankinter-eur')).filter(r => r.amount > 0);
    const bankUsd = (await paginate('chase-usd')).filter(r => r.amount > 0);

    console.log('Data loaded:');
    console.log('  BT Revenue:', btRev.length);
    console.log('  BT Amex:', btAmex.length);
    console.log('  Invoice-Orders:', io.length);
    console.log('  Bankinter EUR inflows:', bankEur.length);
    console.log('  Chase USD inflows:', bankUsd.length);

    // === ANALYSIS 1: Current bank reconciliation state ===
    console.log('\n=== 1. BANK RECONCILIATION STATE ===');
    const bankAll = [...bankEur, ...bankUsd];
    const bankRecon = bankAll.filter(r => r.reconciled);
    const bankWithPS = bankAll.filter(r => r.custom_data?.paymentSource);
    const bankWithTxIds = bankAll.filter(r => r.custom_data?.transaction_ids?.length > 0);
    console.log('Total bank inflows:', bankAll.length);
    console.log('  Reconciled:', bankRecon.length, `(${Math.round(bankRecon.length / bankAll.length * 100)}%)`);
    console.log('  With paymentSource:', bankWithPS.length);
    console.log('  With transaction_ids:', bankWithTxIds.length);

    // === ANALYSIS 2: BT Revenue reconciliation with invoice-orders ===
    console.log('\n=== 2. BT REVENUE → INVOICE-ORDERS ===');
    const allBT = [...btRev, ...btAmex];
    const btWithTxId = allBT.filter(r => r.custom_data?.transaction_id);
    const btWithMatchedInv = allBT.filter(r => r.custom_data?.matched_invoice_number);
    const btWithOrderId = allBT.filter(r => r.custom_data?.order_id);
    const btWithEmail = allBT.filter(r => r.custom_data?.customer_email);
    const btWithName = allBT.filter(r => r.custom_data?.customer_name);
    console.log('All BT transactions:', allBT.length);
    console.log('  With transaction_id:', btWithTxId.length);
    console.log('  With order_id:', btWithOrderId.length);
    console.log('  With customer_email:', btWithEmail.length);
    console.log('  With customer_name:', btWithName.length);
    console.log('  Already matched to invoice:', btWithMatchedInv.length, `(${Math.round(btWithMatchedInv.length / allBT.length * 100)}%)`);

    // Unmatched BT transactions
    const btUnmatched = allBT.filter(r => r.custom_data?.transaction_id && !r.custom_data?.matched_invoice_number);
    console.log('  UNMATCHED (have txId, no invoice match):', btUnmatched.length);

    // === ANALYSIS 3: Build maps for matching simulation ===
    console.log('\n=== 3. MATCHING SIMULATION ===');

    // Invoice-orders maps
    const ioByInvNum = new Map();
    const ioByName = new Map();
    const ioByAmount = new Map();
    io.forEach(r => {
        const cd = r.custom_data || {};
        const invNum = cd.invoice_number;
        const name = normalize(cd.customer_name);
        const amount = Math.abs(parseFloat(r.amount) || 0);

        if (invNum) {
            if (!ioByInvNum.has(invNum)) ioByInvNum.set(invNum, []);
            ioByInvNum.get(invNum).push(r);
        }
        if (name) {
            if (!ioByName.has(name)) ioByName.set(name, []);
            ioByName.get(name).push(r);
        }
        // Round to nearest integer for amount grouping
        const amtKey = Math.round(amount);
        if (!ioByAmount.has(amtKey)) ioByAmount.set(amtKey, []);
        ioByAmount.get(amtKey).push(r);
    });

    console.log('Invoice-orders maps:');
    console.log('  Unique invoice_numbers:', ioByInvNum.size);
    console.log('  Unique customer_names:', ioByName.size);
    console.log('  Unique amounts (rounded):', ioByAmount.size);

    // === SIMULATE MATCHING STRATEGIES ===
    let matchByOrderId = 0;
    let matchByName = 0;
    let matchByNameAmount = 0;
    let matchByEmail = 0;
    let matchByAmountDate = 0;
    let totalClassified = 0;

    // Strategy 1: order_id match
    btUnmatched.forEach(bt => {
        const orderId = bt.custom_data?.order_id;
        if (!orderId) return;
        // Check if any invoice-order has this order in invoice_number
        const matches = io.filter(o => {
            const invNum = o.custom_data?.invoice_number || '';
            return invNum.includes(orderId) || (o.custom_data?.order_id && o.custom_data.order_id === orderId);
        });
        if (matches.length > 0) matchByOrderId++;
    });
    console.log('\nStrategy 1 - order_id → invoice_number:', matchByOrderId, 'potential matches');

    // Strategy 2: customer_name + amount (±2%)
    btUnmatched.forEach(bt => {
        const name = normalize(bt.custom_data?.customer_name);
        if (!name || name.length < 3) return;
        const amount = Math.abs(parseFloat(bt.amount) || 0);
        if (amount === 0) return;

        const candidates = ioByName.get(name);
        if (!candidates) return;

        const match = candidates.find(o => {
            const oAmt = Math.abs(parseFloat(o.amount) || 0);
            return Math.abs(oAmt - amount) <= Math.max(amount * 0.02, 1);
        });
        if (match) matchByNameAmount++;
    });
    console.log('Strategy 2 - customer_name + amount (±2%):', matchByNameAmount, 'potential matches');

    // Strategy 3: customer_name only (loose)
    btUnmatched.forEach(bt => {
        const name = normalize(bt.custom_data?.customer_name);
        if (!name || name.length < 3) return;
        if (ioByName.has(name)) matchByName++;
    });
    console.log('Strategy 3 - customer_name only (any invoice for same customer):', matchByName, 'potential matches');

    // Strategy 4: amount + date (±€1, ±5d)
    btUnmatched.forEach(bt => {
        const amount = Math.abs(parseFloat(bt.amount) || 0);
        const date = bt.date;
        if (!amount || !date) return;

        const amtKey = Math.round(amount);
        const candidates = [];
        for (let delta = -1; delta <= 1; delta++) {
            const cands = ioByAmount.get(amtKey + delta) || [];
            candidates.push(...cands);
        }

        const btDate = new Date(date).getTime();
        const match = candidates.find(o => {
            const oAmt = Math.abs(parseFloat(o.amount) || 0);
            const oDate = new Date(o.date).getTime();
            const dateDiff = Math.abs(btDate - oDate) / (1000 * 60 * 60 * 24);
            return Math.abs(oAmt - amount) <= 1 && dateDiff <= 5;
        });
        if (match) matchByAmountDate++;
    });
    console.log('Strategy 4 - amount + date (±€1, ±5d):', matchByAmountDate, 'potential matches');

    // === ANALYSIS 4: Chain completeness for bank rows ===
    console.log('\n=== 4. CHAIN: BANK → BT → INVOICE → P&L ===');

    // Build txId → BT custom_data map
    const txMap = {};
    allBT.forEach(r => {
        if (r.custom_data?.transaction_id) {
            txMap[r.custom_data.transaction_id] = r.custom_data;
        }
    });

    // Build invoice_number → financial_account_code
    const invToFac = {};
    io.forEach(r => {
        if (r.custom_data?.invoice_number && r.custom_data?.financial_account_code) {
            invToFac[r.custom_data.invoice_number] = r.custom_data.financial_account_code;
        }
    });

    let chainComplete = 0, chainPartialTx = 0, chainPartialNoInv = 0, chainNone = 0;

    bankWithTxIds.forEach(bank => {
        const txIds = bank.custom_data.transaction_ids;
        let foundInv = false, foundTx = false;

        for (const txId of txIds) {
            const bt = txMap[txId];
            if (bt) {
                foundTx = true;
                if (bt.matched_invoice_number && invToFac[bt.matched_invoice_number]) {
                    foundInv = true;
                    break;
                }
            }
        }

        if (foundInv) chainComplete++;
        else if (foundTx) chainPartialNoInv++;
        else chainNone++;
    });

    console.log('Bank rows with transaction_ids:', bankWithTxIds.length);
    console.log('  ✓ Complete chain (bank→BT→invoice→P&L):', chainComplete, `(${Math.round(chainComplete / bankWithTxIds.length * 100)}%)`);
    console.log('  ~ Partial (BT found, no invoice match):', chainPartialNoInv, `(${Math.round(chainPartialNoInv / bankWithTxIds.length * 100)}%)`);
    console.log('  ✗ None (BT tx not found):', chainNone);

    // === ANALYSIS 5: What if we match more BT→invoice? ===
    console.log('\n=== 5. PROJECTED IMPROVEMENT ===');

    // For bank rows where chain is partial, count how many BT txs we COULD match
    let canImproveByName = 0;
    let canImproveByNameAmt = 0;
    let txNeedingMatch = 0;

    bankWithTxIds.forEach(bank => {
        const txIds = bank.custom_data.transaction_ids;
        let alreadyMatchedInBT = false;

        for (const txId of txIds) {
            const bt = txMap[txId];
            if (bt?.matched_invoice_number && invToFac[bt.matched_invoice_number]) {
                alreadyMatchedInBT = true;
                break;
            }
        }

        if (alreadyMatchedInBT) return; // already complete

        // Try to match any BT tx from this bank row
        let couldMatch = false;
        for (const txId of txIds) {
            const bt = txMap[txId];
            if (!bt) continue;
            txNeedingMatch++;

            const name = normalize(bt.customer_name);
            const amount = Math.abs(parseFloat(bt.amount || '0'));

            if (name && ioByName.has(name)) {
                canImproveByName++;
                const candidates = ioByName.get(name);
                const match = candidates.find(o => {
                    const oAmt = Math.abs(parseFloat(o.amount) || 0);
                    return Math.abs(oAmt - amount) <= Math.max(amount * 0.02, 1);
                });
                if (match) {
                    canImproveByNameAmt++;
                    couldMatch = true;
                }
                break; // one tx is enough to classify the bank row
            }
        }
    });

    console.log('BT tx in partial bank rows needing invoice match:', txNeedingMatch);
    console.log('  Could match by customer_name (any invoice):', canImproveByName);
    console.log('  Could match by customer_name + amount (±2%):', canImproveByNameAmt);
    console.log();

    // Potential chain % after improvements
    const potentialComplete = chainComplete + canImproveByNameAmt;
    console.log('Current chain completion:', chainComplete + '/' + bankWithTxIds.length, `(${Math.round(chainComplete / bankWithTxIds.length * 100)}%)`);
    console.log('Projected after name+amt match:', potentialComplete + '/' + bankWithTxIds.length, `(${Math.round(potentialComplete / bankWithTxIds.length * 100)}%)`);

    // == Overall inflow classification
    console.log('\n=== 6. OVERALL P&L CLASSIFICATION PROJECTION ===');
    const totalInflows = bankAll.length;
    const withGateway = bankWithPS.length;
    const withTxIds = bankWithTxIds.length;
    const currentP_L = chainComplete;
    const projectedP_L = potentialComplete;

    console.log('Total bank inflows:', totalInflows);
    console.log('  With gateway (reconciled):', withGateway, `(${Math.round(withGateway / totalInflows * 100)}%)`);
    console.log('  With transaction_ids:', withTxIds, `(${Math.round(withTxIds / totalInflows * 100)}%)`);
    console.log('  Current P&L classified:', currentP_L, `(${Math.round(currentP_L / totalInflows * 100)}%)`);
    console.log('  Projected P&L classified:', projectedP_L, `(${Math.round(projectedP_L / totalInflows * 100)}%)`);

    // === ANALYSIS 7: What blocks higher coverage? ===
    console.log('\n=== 7. COVERAGE BLOCKERS ===');

    // Bank rows without any reconciliation
    const bankNoRecon = bankAll.filter(r => !r.reconciled && !r.custom_data?.paymentSource);
    console.log('Bank inflows without any gateway match:', bankNoRecon.length);

    // Sample unreconciled descriptions
    console.log('\nSample unreconciled bank inflows (to understand what they are):');
    bankNoRecon.slice(0, 15).forEach(r => {
        console.log(`  ${r.date} | ${r.amount.toFixed(2)} | ${r.description.substring(0, 80)} | src:${r.source}`);
    });

    // === ANALYSIS 8: BT transactions in bank rows that CAN be matched ===
    console.log('\n=== 8. SAMPLE MATCHING OPPORTUNITIES ===');
    let shown = 0;
    bankWithTxIds.forEach(bank => {
        if (shown >= 5) return;
        const txIds = bank.custom_data.transaction_ids;
        let alreadyComplete = false;
        for (const txId of txIds) {
            const bt = txMap[txId];
            if (bt?.matched_invoice_number && invToFac[bt.matched_invoice_number]) {
                alreadyComplete = true;
                break;
            }
        }
        if (alreadyComplete) return;

        // Show first unmatched BT tx and potential IO matches
        for (const txId of txIds) {
            const bt = txMap[txId];
            if (!bt) continue;
            const name = normalize(bt.customer_name);
            const amount = Math.abs(parseFloat(bt.amount || '0'));

            if (name && ioByName.has(name)) {
                const candidates = ioByName.get(name);
                const match = candidates.find(o => {
                    const oAmt = Math.abs(parseFloat(o.amount) || 0);
                    return Math.abs(oAmt - amount) <= Math.max(amount * 0.02, 1);
                });
                if (match) {
                    console.log(`\nBank: ${bank.amount.toFixed(2)} | ${bank.date}`);
                    console.log(`  BT tx: ${txId} | customer: ${bt.customer_name} | amt: ${bt.amount}`);
                    console.log(`  IO match: ${match.custom_data?.invoice_number} | ${match.custom_data?.customer_name} | amt: ${match.amount} | FAC: ${match.custom_data?.financial_account_code}`);
                    shown++;
                    break;
                }
            }
        }
    });

    // === ANALYSIS 9: What % of BT revenue matches can we find? ===
    console.log('\n\n=== 9. ALL BT → INVOICE MATCHING POTENTIAL ===');

    let s1_orderId = 0, s2_nameAmt = 0, s3_nameOnly = 0, s4_amtDate = 0;
    const btNotMatched = allBT.filter(r => r.custom_data?.transaction_id && !r.custom_data?.matched_invoice_number);

    btNotMatched.forEach(bt => {
        const cd = bt.custom_data;
        const orderId = cd.order_id;
        const name = normalize(cd.customer_name);
        const amount = Math.abs(parseFloat(bt.amount) || 0);
        const date = bt.date;

        // S1: order_id
        if (orderId) {
            const match = io.find(o => {
                const invNum = o.custom_data?.invoice_number || '';
                return invNum.includes(orderId);
            });
            if (match) { s1_orderId++; return; }
        }

        // S2: name + amount
        if (name && ioByName.has(name)) {
            const candidates = ioByName.get(name);
            const match = candidates.find(o => {
                const oAmt = Math.abs(parseFloat(o.amount) || 0);
                return Math.abs(oAmt - amount) <= Math.max(amount * 0.02, 1);
            });
            if (match) { s2_nameAmt++; return; }
        }

        // S3: name only (get P&L from any invoice of same customer)
        if (name && ioByName.has(name)) {
            s3_nameOnly++;
            return;
        }

        // S4: amount + date
        if (amount > 0 && date) {
            const amtKey = Math.round(amount);
            const candidates = [];
            for (let d = -1; d <= 1; d++) {
                const c = ioByAmount.get(amtKey + d) || [];
                candidates.push(...c);
            }
            const btDate = new Date(date).getTime();
            const match = candidates.find(o => {
                const oAmt = Math.abs(parseFloat(o.amount) || 0);
                const oDate = new Date(o.date).getTime();
                return Math.abs(oAmt - amount) <= 1 && Math.abs(btDate - oDate) / 86400000 <= 5;
            });
            if (match) { s4_amtDate++; return; }
        }
    });

    const totalUnmatched = btNotMatched.length;
    const totalMatched = s1_orderId + s2_nameAmt + s3_nameOnly + s4_amtDate;

    console.log('BT transactions without invoice match:', totalUnmatched);
    console.log('  S1 order_id match:', s1_orderId);
    console.log('  S2 name+amount match:', s2_nameAmt);
    console.log('  S3 name-only match (P&L from any invoice):', s3_nameOnly);
    console.log('  S4 amount+date match:', s4_amtDate);
    console.log('  Total matchable:', totalMatched, `(${Math.round(totalMatched / totalUnmatched * 100)}%)`);
    console.log('  Remaining unmatched:', totalUnmatched - totalMatched);

    // Overall BT coverage
    const alreadyMatched = allBT.filter(r => r.custom_data?.matched_invoice_number).length;
    console.log('\nOverall BT → Invoice coverage:');
    console.log('  Already matched:', alreadyMatched);
    console.log('  + New matches:', totalMatched);
    console.log('  = Total:', alreadyMatched + totalMatched, '/', allBT.length, `(${Math.round((alreadyMatched + totalMatched) / allBT.length * 100)}%)`);

    process.exit(0);
})();
