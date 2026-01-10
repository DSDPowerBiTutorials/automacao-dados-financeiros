import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prepareSettlementBatches, reconcileAllSettlementBatches } from "@/lib/braintree-settlement-reconciliation";

export const dynamic = "force-dynamic"; // avoid caching reconciliation results

export async function POST() {
    try {
        const { data, error } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, amount, date, custom_data, reconciled")
            .or("source.eq.braintree-api-revenue,source.eq.braintree-eur")
            .gte("date", "2024-01-01")
            .order("date", { ascending: false });

        if (error) {
            console.error("[API][braintree-eur reconcile] Supabase error", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const transactions = (data || []).filter((row) => {
            const merchant = row.custom_data?.merchant_account_id;
            const currency = row.custom_data?.currency;
            const isEUR = currency === "EUR" || merchant === "digitalsmiledesignEUR" || !merchant;
            return isEUR;
        });

        const batches = prepareSettlementBatches(transactions, "EUR");

        if (batches.length === 0) {
            return NextResponse.json({ success: true, data: { total: 0, reconciled: 0, failed: 0, results: [] } });
        }

        const result = await reconcileAllSettlementBatches(batches, supabaseAdmin);

        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        console.error("[API][braintree-eur reconcile] Unexpected error", err);
        return NextResponse.json({ success: false, error: err?.message || "Unexpected error" }, { status: 500 });
    }
}
