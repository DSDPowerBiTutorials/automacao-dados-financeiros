#!/usr/bin/env node
/**
 * Cleanup script: Remove duplicate rows from csv_rows
 * 
 * - Invoice-orders: dedup by invoice_number (keep most recent)
 * - HubSpot: dedup by deal_id AND by ecomm_order_number (keep reconciled/most recent)
 * 
 * Usage: node scripts/cleanup-duplicates.js [--dry-run]
 */

const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error("❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(url, key);
const DRY_RUN = process.argv.includes("--dry-run");

async function fetchAll(source) {
    const rows = [];
    let from = 0;
    const PAGE = 1000;
    while (true) {
        const { data, error } = await supabase
            .from("csv_rows")
            .select("id, custom_data, reconciled, created_at")
            .eq("source", source)
            .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return rows;
}

async function deleteRows(ids) {
    if (ids.length === 0) return;
    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would delete ${ids.length} rows`);
        return;
    }
    for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500);
        const { error } = await supabase.from("csv_rows").delete().in("id", batch);
        if (error) console.error("  Delete error:", error.message);
    }
    console.log(`  ✅ Deleted ${ids.length} rows`);
}

function pickKeeper(rows) {
    // Prefer reconciled rows, then most recent created_at
    const reconciled = rows.filter(r => r.reconciled);
    if (reconciled.length > 0) {
        reconciled.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        return reconciled[0].id;
    }
    rows.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return rows[0].id;
}

async function cleanInvoiceOrders() {
    console.log("\n📋 Invoice-Orders: dedup by invoice_number...");
    const rows = await fetchAll("invoice-orders");
    console.log(`  Total rows: ${rows.length}`);

    const groups = new Map();
    for (const row of rows) {
        const inv = row.custom_data?.invoice_number || row.custom_data?.Number;
        if (!inv) continue;
        if (!groups.has(inv)) groups.set(inv, []);
        groups.get(inv).push(row);
    }

    const toDelete = [];
    for (const [inv, group] of groups) {
        if (group.length <= 1) continue;
        const keepId = pickKeeper(group);
        for (const row of group) {
            if (row.id !== keepId) toDelete.push(row.id);
        }
    }

    const dupGroups = [...groups.values()].filter(g => g.length > 1).length;
    console.log(`  Duplicate groups: ${dupGroups}`);
    console.log(`  Rows to delete: ${toDelete.length}`);
    await deleteRows(toDelete);
    return toDelete.length;
}

async function cleanHubSpot() {
    console.log("\n🔷 HubSpot: dedup by deal_id...");
    const rows = await fetchAll("hubspot");
    console.log(`  Total rows: ${rows.length}`);

    // Phase 1: Dedup by deal_id
    const dealGroups = new Map();
    for (const row of rows) {
        const dealId = row.custom_data?.deal_id;
        if (!dealId) continue;
        const key = String(dealId);
        if (!dealGroups.has(key)) dealGroups.set(key, []);
        dealGroups.get(key).push(row);
    }

    const toDeleteDealId = [];
    const survivingRows = [];
    for (const [dealId, group] of dealGroups) {
        if (group.length <= 1) {
            survivingRows.push(group[0]);
            continue;
        }
        const keepId = pickKeeper(group);
        for (const row of group) {
            if (row.id !== keepId) {
                toDeleteDealId.push(row.id);
            } else {
                survivingRows.push(row);
            }
        }
    }

    const dealDupGroups = [...dealGroups.values()].filter(g => g.length > 1).length;
    console.log(`  Deal_id duplicate groups: ${dealDupGroups}`);
    console.log(`  Rows to delete (deal_id): ${toDeleteDealId.length}`);

    // Phase 2: Dedup surviving rows by order_number
    const orderGroups = new Map();
    for (const row of survivingRows) {
        const orderNum = row.custom_data?.ecomm_order_number || row.custom_data?.website_order_id;
        if (!orderNum) continue;
        if (!orderGroups.has(orderNum)) orderGroups.set(orderNum, []);
        orderGroups.get(orderNum).push(row);
    }

    const toDeleteOrder = [];
    for (const [orderNum, group] of orderGroups) {
        if (group.length <= 1) continue;
        const keepId = pickKeeper(group);
        for (const row of group) {
            if (row.id !== keepId) toDeleteOrder.push(row.id);
        }
    }

    const orderDupGroups = [...orderGroups.values()].filter(g => g.length > 1).length;
    console.log(`  Order_number duplicate groups: ${orderDupGroups}`);
    console.log(`  Rows to delete (order_number): ${toDeleteOrder.length}`);

    const allToDelete = [...toDeleteDealId, ...toDeleteOrder];
    console.log(`  Total to delete: ${allToDelete.length}`);
    await deleteRows(allToDelete);
    return allToDelete.length;
}

async function main() {
    if (DRY_RUN) {
        console.log("🏃 DRY RUN mode — no data will be deleted\n");
    } else {
        console.log("⚠️  LIVE mode — duplicates will be DELETED\n");
    }

    const invoiceDel = await cleanInvoiceOrders();
    const hubspotDel = await cleanHubSpot();

    console.log("\n" + "=".repeat(50));
    console.log(`📊 Summary: ${invoiceDel + hubspotDel} total duplicates ${DRY_RUN ? "found" : "deleted"}`);
    console.log(`   Invoice-orders: ${invoiceDel}`);
    console.log(`   HubSpot: ${hubspotDel}`);
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
