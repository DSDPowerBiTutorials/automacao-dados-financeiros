/**
 * One-time fix: Add canonical fields to the bank row reconciled with order 30f36b5
 */
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // 1. Find bank rows with matched_order_id containing 30f36b5
    const { data: rows, error } = await supabase
        .from("csv_rows")
        .select("id, date, description, amount, source, reconciled, custom_data")
        .or("custom_data->>matched_order_id.eq.30f36b5,custom_data->>matched_order_id.like.%30f36b5%,custom_data->>invoice_order_id.eq.30f36b5")
        .limit(10);

    if (error) {
        console.error("Error querying csv_rows:", error);
        return;
    }

    if (!rows || rows.length === 0) {
        console.log("No rows found. Trying ar_invoices reconciled_with...");

        // Try finding via ar_invoices that has 30f36b5
        const { data: invoices } = await supabase
            .from("ar_invoices")
            .select("id, order_id, invoice_number, client_name, total_amount, currency, reconciled, reconciled_with")
            .eq("order_id", "30f36b5")
            .limit(5);

        console.log("ar_invoices with order_id=30f36b5:", JSON.stringify(invoices, null, 2));

        if (invoices && invoices.length > 0 && invoices[0].reconciled_with) {
            const bankRowId = invoices[0].reconciled_with;
            console.log("\nBank row ID from ar_invoices.reconciled_with:", bankRowId);

            const { data: bankRow } = await supabase
                .from("csv_rows")
                .select("id, date, description, amount, source, reconciled, custom_data")
                .eq("id", bankRowId)
                .single();

            if (bankRow) {
                console.log("\nBank row found:", bankRow.id, bankRow.date, bankRow.description?.substring(0, 60), bankRow.amount);
                console.log("Current custom_data:", JSON.stringify(bankRow.custom_data, null, 2));

                await fixRecord(bankRow, invoices[0]);
            }
        }
        return;
    }

    for (const row of rows) {
        console.log("Found bank row:", row.id, row.date, row.description?.substring(0, 60), row.amount);
        console.log("Custom data:", JSON.stringify(row.custom_data, null, 2));

        // Fetch the ar_invoice
        const orderId = row.custom_data?.matched_order_id || row.custom_data?.invoice_order_id;
        if (orderId) {
            const { data: inv } = await supabase
                .from("ar_invoices")
                .select("id, order_id, invoice_number, client_name, total_amount, currency")
                .eq("order_id", orderId)
                .single();

            if (inv) {
                await fixRecord(row, inv);
            }
        }
    }
}

async function fixRecord(bankRow, invoice) {
    const cd = bankRow.custom_data || {};

    // Check if canonical fields already exist
    if (cd.invoice_order_id && cd.invoice_number && cd.invoice_order_matched) {
        console.log("✓ Record already has canonical fields. No fix needed.");
        return;
    }

    const updatedCustomData = {
        ...cd,
        // Add canonical fields
        invoice_order_id: cd.invoice_order_id || cd.matched_order_id || invoice.order_id,
        invoice_number: cd.invoice_number || cd.matched_invoice_number || invoice.invoice_number,
        invoice_order_matched: true,
        // Ensure matched fields are present
        matched_order_id: cd.matched_order_id || invoice.order_id,
        matched_invoice_number: cd.matched_invoice_number || invoice.invoice_number,
        matched_customer_name: cd.matched_customer_name || invoice.client_name,
        matched_order_amount: cd.matched_order_amount || invoice.total_amount,
    };

    const { error: updateErr } = await supabase
        .from("csv_rows")
        .update({ custom_data: updatedCustomData })
        .eq("id", bankRow.id);

    if (updateErr) {
        console.error("Error updating:", updateErr);
        return;
    }

    console.log("\n✓ Fixed! Added canonical fields to bank row", bankRow.id);
    console.log("  invoice_order_id:", updatedCustomData.invoice_order_id);
    console.log("  invoice_number:", updatedCustomData.invoice_number);
    console.log("  invoice_order_matched:", true);
    console.log("  matched_customer_name:", updatedCustomData.matched_customer_name);
    console.log("  matched_order_amount:", updatedCustomData.matched_order_amount);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
