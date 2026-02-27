import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Only fetch columns the page actually uses (not all 50+)
const INVOICE_COLUMNS = [
    "id",
    "input_date",
    "invoice_date",
    "benefit_date",
    "due_date",
    "schedule_date",
    "payment_date",
    "invoice_type",
    "entry_type",
    "financial_account_code",
    "financial_account_name",
    "invoice_amount",
    "currency",
    "eur_exchange",
    "provider_code",
    "bank_account_code",
    "course_code",
    "payment_method_code",
    "cost_type_code",
    "dep_cost_type_code",
    "cost_center_code",
    "sub_department_code",
    "description",
    "invoice_number",
    "country_code",
    "scope",
    "dre_impact",
    "cash_impact",
    "is_intercompany",
    "payment_status",
    "notes",
    "is_split",
    "parent_invoice_id",
    "split_number",
    "total_splits",
    "split_type",
    "paid_amount",
    "paid_currency",
    "is_reconciled",
    "reconciled_transaction_id",
    "reconciled_at",
    "reconciled_amount",
    "created_at"
].join(",");

const BANK_STATEMENT_SOURCES = new Set(["bankinter-eur", "bankinter-usd", "sabadell", "chase-usd"]);

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const year = searchParams.get("year");

        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            let query = supabaseAdmin
                .from("invoices")
                .select(INVOICE_COLUMNS)
                .order("id", { ascending: true })
                .range(offset, offset + pageSize - 1);

            // Optional year filter to reduce payload
            if (year) {
                query = query.gte("invoice_date", `${year}-01-01`).lte("invoice_date", `${year}-12-31`);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Error fetching invoices:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            offset += pageSize;

            if (data.length < pageSize) break;
        }

        const txIds = Array.from(
            new Set(
                allData
                    .map((inv) => inv.reconciled_transaction_id)
                    .filter((value): value is string => typeof value === "string" && value.length > 0)
            )
        );

        const reconciledTxMap = new Map<string, { reconciled: boolean; source: string | null }>();

        if (txIds.length > 0) {
            const chunkSize = 500;
            for (let i = 0; i < txIds.length; i += chunkSize) {
                const chunk = txIds.slice(i, i + chunkSize);
                const { data: txRows, error: txError } = await supabaseAdmin
                    .from("csv_rows")
                    .select("id,reconciled,source")
                    .in("id", chunk);

                if (txError) {
                    console.error("Error fetching bank statement rows for AP sync:", txError);
                } else {
                    (txRows || []).forEach((tx: any) => {
                        reconciledTxMap.set(tx.id, {
                            reconciled: !!tx.reconciled,
                            source: tx.source || null,
                        });
                    });
                }
            }
        }

        const syncedData = allData.map((inv) => {
            const txId = inv.reconciled_transaction_id as string | null;
            if (!txId) {
                return {
                    ...inv,
                    is_reconciled: false,
                };
            }

            const tx = reconciledTxMap.get(txId);
            const validBankTx = !!tx && tx.reconciled && !!tx.source && BANK_STATEMENT_SOURCES.has(tx.source);

            return {
                ...inv,
                is_reconciled: validBankTx,
                payment_status: validBankTx ? "PAID" : inv.payment_status,
            };
        });

        console.log(`📋 Invoices API: ${syncedData.length} invoices loaded${year ? ` (year=${year})` : ""}`);

        return NextResponse.json({ data: syncedData, count: syncedData.length });
    } catch (e: any) {
        console.error("Error in invoices list API:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
