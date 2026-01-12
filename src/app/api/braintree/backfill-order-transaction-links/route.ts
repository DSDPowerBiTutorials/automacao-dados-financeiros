import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Body = {
    dryRun?: boolean;
    limit?: number;
    provider?: string;
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json().catch(() => ({}))) as Body;

        const dryRun = body.dryRun !== false;
        const limit = Math.min(Math.max(body.limit ?? 2000, 1), 20000);
        const provider = (body.provider || "braintree").trim() || "braintree";

        const { data: rows, error } = await supabaseAdmin
            .from("csv_rows")
            .select("id, source, date, amount, description, custom_data")
            .eq("source", "braintree-api-revenue")
            .order("date", { ascending: true })
            .limit(limit);

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        const candidates = (rows || [])
            .map((r: any) => {
                const orderId = r.custom_data?.order_id;
                const transactionId = r.custom_data?.transaction_id;
                if (!orderId || !transactionId) return null;
                return {
                    provider,
                    order_id: String(orderId),
                    transaction_id: String(transactionId),
                    disbursement_id: r.custom_data?.disbursement_id || null,
                    merchant_account_id: r.custom_data?.merchant_account_id || null,
                    currency: r.custom_data?.currency || null,
                    link_metadata: {
                        csv_row_id: r.id,
                        source: r.source,
                        date: r.date,
                        amount: r.amount,
                        description: r.description,
                    },
                };
            })
            .filter(Boolean) as any[];

        if (dryRun) {
            return NextResponse.json({
                success: true,
                dryRun: true,
                stats: {
                    scanned: rows?.length || 0,
                    candidates: candidates.length,
                },
                sample: candidates.slice(0, 5),
            });
        }

        if (candidates.length === 0) {
            return NextResponse.json({
                success: true,
                dryRun: false,
                message: "Nenhum vínculo encontrado para inserir",
                stats: { scanned: rows?.length || 0, insertedOrUpdated: 0 },
            });
        }

        const { data: upserted, error: upsertError } = await supabaseAdmin
            .from("order_transaction_links")
            .upsert(candidates, { onConflict: "provider,transaction_id" })
            .select("id");

        if (upsertError) {
            return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            dryRun: false,
            stats: {
                scanned: rows?.length || 0,
                candidates: candidates.length,
                insertedOrUpdated: upserted?.length || 0,
            },
        });
    } catch (err: any) {
        return NextResponse.json(
            { success: false, error: err?.message || "Unexpected error" },
            { status: 500 },
        );
    }
}
