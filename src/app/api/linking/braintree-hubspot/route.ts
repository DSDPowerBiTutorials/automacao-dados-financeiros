import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Body = {
    orderIds?: string[];
    dryRun?: boolean;
    currency?: string; // opcional (ex.: EUR)
    limit?: number;
};

function uniqStrings(values: any[], limit: number): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of values || []) {
        const s = String(v ?? "").trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
        if (out.length >= limit) break;
    }
    return out;
}

function toDateOnly(value?: string | null): string | null {
    if (!value) return null;
    try {
        return new Date(value).toISOString().split("T")[0];
    } catch {
        const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : null;
    }
}

function pickBestBraintreeRow(rows: any[]): any | null {
    if (!rows?.length) return null;
    const sorted = [...rows].sort((a, b) => {
        const aCd = a.custom_data || {};
        const bCd = b.custom_data || {};

        const aHasTx = aCd.transaction_id ? 1 : 0;
        const bHasTx = bCd.transaction_id ? 1 : 0;
        if (aHasTx !== bHasTx) return bHasTx - aHasTx;

        const aHasDisb = aCd.disbursement_date ? 1 : 0;
        const bHasDisb = bCd.disbursement_date ? 1 : 0;
        if (aHasDisb !== bHasDisb) return bHasDisb - aHasDisb;

        const aDate = new Date(a.date || 0).getTime();
        const bDate = new Date(b.date || 0).getTime();
        return bDate - aDate;
    });
    return sorted[0] || null;
}

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as Body;

        const dryRun = body.dryRun === true;
        const orderIds = uniqStrings(body.orderIds || [], Math.min(Math.max(body.limit ?? 250, 1), 500));
        const currencyHint = (body.currency || "").trim().toUpperCase();

        if (orderIds.length === 0) {
            return NextResponse.json(
                { success: false, error: "orderIds é obrigatório" },
                { status: 400 },
            );
        }

        // 1) Braintree (por order_id)
        const { data: btRows, error: btErr } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, custom_data")
            .eq("source", "braintree-api-revenue")
            // Supabase aceita caminho json como coluna
            .in("custom_data->>order_id", orderIds);

        if (btErr) {
            return NextResponse.json({ success: false, error: btErr.message }, { status: 500 });
        }

        const btByOrder = new Map<string, any[]>();
        for (const r of btRows || []) {
            const orderId = r.custom_data?.order_id;
            if (!orderId) continue;
            if (currencyHint) {
                const cur = (r.custom_data?.currencyIsoCode || r.custom_data?.currency_iso_code || r.custom_data?.currency || "").toUpperCase();
                if (cur && cur !== currencyHint) continue;
            }
            const key = String(orderId);
            const arr = btByOrder.get(key) || [];
            arr.push(r);
            btByOrder.set(key, arr);
        }

        // 2) HubSpot (por order_code)
        const { data: hsRows, error: hsErr } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, custom_data")
            .eq("source", "hubspot")
            .in("custom_data->>order_code", orderIds);

        if (hsErr) {
            return NextResponse.json({ success: false, error: hsErr.message }, { status: 500 });
        }

        const hsByOrder = new Map<string, any>();
        for (const r of hsRows || []) {
            const code = r.custom_data?.order_code;
            if (!code) continue;
            hsByOrder.set(String(code), r);
        }

        const updatesHubspot: Array<{ id: string; custom_data: any }> = [];
        const updatesBraintree: Array<{ id: string; custom_data: any }> = [];

        const links = orderIds.map((orderId) => {
            const btBest = pickBestBraintreeRow(btByOrder.get(orderId) || []);
            const hs = hsByOrder.get(orderId) || null;

            if (btBest && hs) {
                const btCd = btBest.custom_data || {};
                const hsCd = hs.custom_data || {};

                const currency = (currencyHint || btCd.currencyIsoCode || btCd.currency_iso_code || btCd.currency || "EUR").toString().toUpperCase();
                const bankDestinationAccount = `Bankinter ${currency}`;

                const mergedHubspot = {
                    ...hsCd,
                    // Linkagem
                    braintree_order_id: orderId,
                    braintree_transaction_id: btCd.transaction_id || null,
                    braintree_transaction_ids: btCd.transaction_id ? [btCd.transaction_id] : hsCd.braintree_transaction_ids || [],
                    // Status/datas (mesmo tipo do popover do Braintree)
                    braintree_status: btCd.status || null,
                    braintree_status_history: btCd.status_history || [],
                    braintree_settlement_batch_id: btCd.settlement_batch_id || null,
                    braintree_settlement_date: btCd.settlement_date || toDateOnly(btCd.settlement_date) || null,
                    braintree_disbursement_date: btCd.disbursement_date || null,
                    braintree_settlement_amount: btCd.settlement_amount ?? null,
                    braintree_settlement_currency_iso_code: btCd.settlement_currency_iso_code || btCd.settlement_currency || currency,
                    braintree_settlement_currency_exchange_rate: btCd.settlement_currency_exchange_rate ?? null,
                    braintree_merchant_account_id: btCd.merchant_account_id || null,
                    // Banco (por enquanto, derivado da moeda)
                    bank_destination_account: bankDestinationAccount,
                    linked_at: new Date().toISOString(),
                };

                const mergedBraintree = {
                    ...btCd,
                    hubspot_row_id: hs.id,
                    hubspot_deal_id: hsCd.deal_id || null,
                    hubspot_order_code: orderId,
                    bank_destination_account: btCd.bank_destination_account || bankDestinationAccount,
                };

                updatesHubspot.push({ id: hs.id, custom_data: mergedHubspot });
                updatesBraintree.push({ id: btBest.id, custom_data: mergedBraintree });
            }

            return {
                order_id: orderId,
                hubspot_row_id: hs?.id || null,
                hubspot_deal_id: hs?.custom_data?.deal_id || null,
                braintree_row_id: btBest?.id || null,
                braintree_transaction_id: btBest?.custom_data?.transaction_id || null,
                linked: Boolean(btBest && hs),
            };
        });

        if (!dryRun) {
            // HubSpot updates
            for (const batch of chunk(updatesHubspot, 50)) {
                await Promise.all(
                    batch.map((u) =>
                        supabaseAdmin
                            .from("csv_rows")
                            .update({ custom_data: u.custom_data })
                            .eq("id", u.id),
                    ),
                );
            }

            // Braintree updates (apenas a linha escolhida como "best")
            for (const batch of chunk(updatesBraintree, 50)) {
                await Promise.all(
                    batch.map((u) =>
                        supabaseAdmin
                            .from("csv_rows")
                            .update({ custom_data: u.custom_data })
                            .eq("id", u.id),
                    ),
                );
            }
        }

        return NextResponse.json({
            success: true,
            dryRun,
            stats: {
                requested: orderIds.length,
                braintreeFound: btRows?.length || 0,
                hubspotFound: hsRows?.length || 0,
                linked: links.filter((l) => l.linked).length,
            },
            links,
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || "Unexpected error" },
            { status: 500 },
        );
    }
}
