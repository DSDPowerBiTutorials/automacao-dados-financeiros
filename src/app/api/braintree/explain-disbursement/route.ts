import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function toDateOnly(value: string) {
    try {
        return new Date(value).toISOString().split("T")[0];
    } catch {
        return value;
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const disbursementId = searchParams.get("disbursementId")?.trim();

        if (!disbursementId) {
            return NextResponse.json(
                { success: false, error: "disbursementId é obrigatório" },
                { status: 400 },
            );
        }

        const { data: disbRows, error: disbErr } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, description, custom_data")
            .eq("source", "braintree-api-disbursement")
            .filter("custom_data->>disbursement_id", "eq", disbursementId)
            .limit(1);

        if (disbErr) {
            return NextResponse.json({ success: false, error: disbErr.message }, { status: 500 });
        }

        const disbursement = disbRows?.[0];
        if (!disbursement) {
            return NextResponse.json(
                { success: false, error: "Disbursement não encontrado" },
                { status: 404 },
            );
        }

        const { data: revenueRows, error: revErr } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, description, custom_data")
            .eq("source", "braintree-api-revenue")
            .filter("custom_data->>disbursement_id", "eq", disbursementId)
            .order("date", { ascending: true });

        if (revErr) {
            return NextResponse.json({ success: false, error: revErr.message }, { status: 500 });
        }

        const { data: feeRows, error: feeErr } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, description, custom_data")
            .eq("source", "braintree-api-fees")
            .filter("custom_data->>disbursement_id", "eq", disbursementId)
            .order("date", { ascending: true });

        if (feeErr) {
            return NextResponse.json({ success: false, error: feeErr.message }, { status: 500 });
        }

        const byOrderId = new Map<
            string,
            {
                order_id: string;
                total_amount: number;
                transactions: any[];
                hubspot?: any;
            }
        >();

        for (const row of revenueRows || []) {
            const orderId = row.custom_data?.order_id || "(sem-order-id)";
            const current = byOrderId.get(orderId) || {
                order_id: orderId,
                total_amount: 0,
                transactions: [] as any[],
            };

            current.total_amount += Number(row.amount || 0);
            current.transactions.push({
                id: row.id,
                transaction_id: row.custom_data?.transaction_id,
                date: toDateOnly(row.date),
                amount: row.amount,
                currency: row.custom_data?.currency,
                merchant_account_id: row.custom_data?.merchant_account_id,
                description: row.description,
            });

            byOrderId.set(orderId, current);
        }

        const orderIds = Array.from(byOrderId.keys()).filter((x) => x && x !== "(sem-order-id)");

        let hubspotIndex = new Map<string, any>();
        if (orderIds.length > 0) {
            const orFilters = orderIds
                .slice(0, 200)
                .map((id) => `custom_data->>order_code.eq.${id}`)
                .join(",");

            const { data: hubspotRows, error: hsErr } = await supabaseAdmin
                .from("csv_rows")
                .select("id, source, date, amount, description, custom_data")
                .eq("source", "hubspot")
                .or(orFilters);

            if (hsErr) {
                return NextResponse.json({ success: false, error: hsErr.message }, { status: 500 });
            }

            for (const row of hubspotRows || []) {
                const code = row.custom_data?.order_code;
                if (code) hubspotIndex.set(code, row);
            }
        }

        for (const [orderId, entry] of byOrderId.entries()) {
            if (!orderId || orderId === "(sem-order-id)") continue;
            const hubspot = hubspotIndex.get(orderId);
            if (hubspot) {
                entry.hubspot = {
                    id: hubspot.id,
                    deal_id: hubspot.custom_data?.deal_id,
                    order_code: hubspot.custom_data?.order_code,
                    customer_email: hubspot.customer_email,
                    customer_name: hubspot.customer_name,
                    amount: hubspot.amount,
                    date: hubspot.date,
                    status: hubspot.custom_data?.status,
                };
            }
        }

        const revenueGross = (revenueRows || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const feesTotal = Math.abs((feeRows || []).reduce((sum, r) => sum + Number(r.amount || 0), 0));

        return NextResponse.json({
            success: true,
            data: {
                disbursement: {
                    id: disbursement.id,
                    date: disbursement.date,
                    amount: disbursement.amount,
                    currency: disbursement.custom_data?.currency,
                    merchant_account_id: disbursement.custom_data?.merchant_account_id,
                    disbursement_id: disbursement.custom_data?.disbursement_id,
                    transaction_ids_count: disbursement.custom_data?.transaction_ids?.length || 0,
                },
                totals: {
                    revenue_gross: revenueGross,
                    fees_total: feesTotal,
                    net_expected: Number(revenueGross - feesTotal),
                    revenue_count: (revenueRows || []).length,
                    fee_count: (feeRows || []).length,
                },
                orders: Array.from(byOrderId.values()).sort((a, b) => b.total_amount - a.total_amount),
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || "Unexpected error" },
            { status: 500 },
        );
    }
}
