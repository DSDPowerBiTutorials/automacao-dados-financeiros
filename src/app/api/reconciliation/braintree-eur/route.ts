import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prepareSettlementBatches, reconcileAllSettlementBatches } from "@/lib/braintree-settlement-reconciliation";

export const dynamic = "force-dynamic"; // avoid caching reconciliation results

function toDateOnly(value?: string | null): string | null {
    if (!value) return null;
    try {
        // aceita ISO datetime ou date-only
        return new Date(value).toISOString().split("T")[0];
    } catch {
        // fallback: tenta pegar YYYY-MM-DD no começo
        const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : null;
    }
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function assumePaidByDisbursementDate(
    rows: any[],
    currencyLabel: string,
    dryRun: boolean
): Promise<{ total: number; reconciled: number; failed: number; updatedIds: string[] }> {
    const today = new Date().toISOString().split("T")[0];
    const toUpdate = (rows || [])
        .filter((r) => {
            if (r.reconciled === true) return false;
            const disb = toDateOnly(r.custom_data?.disbursement_date);
            return !!disb && disb <= today;
        })
        .map((r) => ({
            id: r.id,
            custom_data: r.custom_data || {},
            disbursement_date: toDateOnly(r.custom_data?.disbursement_date),
        }));

    if (dryRun) {
        return { total: toUpdate.length, reconciled: toUpdate.length, failed: 0, updatedIds: toUpdate.slice(0, 50).map((x) => x.id) };
    }

    let ok = 0;
    let failed = 0;
    const updatedIds: string[] = [];

    for (const batch of chunk(toUpdate, 50)) {
        const results = await Promise.allSettled(
            batch.map(async (r) => {
                const merged = {
                    ...(r.custom_data || {}),
                    destinationAccount: (r.custom_data || {}).destinationAccount || `Bankinter ${currencyLabel}`,
                    reconciliationType: 'assumed',
                    bank_assumed_paid: true,
                    bank_assumed_paid_at: new Date().toISOString(),
                    bank_assumed_paid_reason: 'disbursement_date <= hoje',
                };

                const { error } = await supabaseAdmin
                    .from('csv_rows')
                    .update({ reconciled: true, custom_data: merged })
                    .eq('id', r.id);

                if (error) throw error;
                return r.id;
            })
        );

        for (const r of results) {
            if (r.status === 'fulfilled') {
                ok++;
                updatedIds.push(r.value);
            } else {
                failed++;
            }
        }
    }

    return { total: toUpdate.length, reconciled: ok, failed, updatedIds };
}

export async function POST(req: Request) {
    try {
        const url = new URL(req.url);
        const dryRun = url.searchParams.get("dryRun") === "1";
        const strategy = (url.searchParams.get('strategy') || 'assume-paid').trim();

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
            const cd = row.custom_data || {};
            const merchant: string | undefined = cd.merchant_account_id;
            const currency: string | undefined = cd.currencyIsoCode || cd.currency_iso_code || cd.currency || row.custom_data?.currency;
            const isEURByCurrency = currency === "EUR";
            const isEURByMerchant = typeof merchant === "string" && merchant.toLowerCase().includes("eur");
            return isEURByCurrency || isEURByMerchant;
        });

        // Estratégia simples (pedido do usuário): assumir que disbursement_date <= hoje => pago/conciliado
        if (strategy === 'assume-paid') {
            const assumed = await assumePaidByDisbursementDate(transactions, 'EUR', dryRun);
            return NextResponse.json({
                success: true,
                dryRun,
                data: {
                    mode: 'assume-paid',
                    total: assumed.total,
                    reconciled: assumed.reconciled,
                    failed: assumed.failed,
                    updatedIds: assumed.updatedIds,
                },
            });
        }

        const batches = prepareSettlementBatches(transactions, "EUR");

        if (batches.length === 0) {
            return NextResponse.json({ success: true, data: { total: 0, reconciled: 0, failed: 0, results: [] } });
        }

        const result = await reconcileAllSettlementBatches(batches, supabaseAdmin, { dryRun });

        if (dryRun) {
            const failures = (result.results || []).filter((r) => !r.success).slice(0, 200);
            return NextResponse.json({ success: true, dryRun: true, data: { ...result, failures } });
        }

        return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
        console.error("[API][braintree-eur reconcile] Unexpected error", err);
        return NextResponse.json({ success: false, error: err?.message || "Unexpected error" }, { status: 500 });
    }
}
