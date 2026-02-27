import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/invoices/schedule
 *
 * Returns all invoices relevant for the AP Schedule page:
 *  - invoices with schedule_date >= 2026-01-01
 *  - invoices with NO schedule_date (unscheduled)
 *
 * Uses supabaseAdmin (service role) to bypass RLS, and paginates
 * in blocks of 1000 to avoid the Supabase default limit.
 */

const SCHEDULE_COLUMNS = [
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
    "invoice_status",
    "country_code",
    "scope",
    "dre_impact",
    "cash_impact",
    "is_intercompany",
    "payment_status",
    "finance_payment_status",
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
    "created_at",
].join(",");

export async function GET() {
    try {
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 1000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("invoices")
                .select(SCHEDULE_COLUMNS)
                .or("schedule_date.is.null,schedule_date.gte.2026-01-01")
                .order("schedule_date", { ascending: true, nullsFirst: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching schedule invoices:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            offset += pageSize;

            if (data.length < pageSize) break;
        }

        console.log(`📅 Schedule API: ${allData.length} invoices loaded (schedule_date >= 2026 or null)`);

        return NextResponse.json({ data: allData, count: allData.length });
    } catch (e: any) {
        console.error("Error in schedule invoices API:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
