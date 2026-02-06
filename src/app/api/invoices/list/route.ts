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
    "created_at"
].join(",");

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

        console.log(`📋 Invoices API: ${allData.length} invoices loaded${year ? ` (year=${year})` : ""}`);

        return NextResponse.json({ data: allData, count: allData.length });
    } catch (e: any) {
        console.error("Error in invoices list API:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
