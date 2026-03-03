import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/ar-invoices
 * Flexible server-side query for ar_invoices (bypasses RLS/GRANT issue).
 *
 * Body shapes:
 *   { action: "search", currency?: string, limit?: number }
 *   { action: "fetch-unreconciled", currency?: string, limit?: number }
 *   { action: "fetch-by-ids", ids: number[], select?: string }
 *   { action: "fetch-by-id", id: number, select?: string }
 *   { action: "fetch-by-order-id", order_id: string, select?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        if (action === "search") {
            const { currency, limit = 5000, query } = body;

            // Server-side text search — use ILIKE for targeted queries
            if (query && typeof query === "string" && query.trim().length >= 2) {
                const q = query.trim();
                const pattern = `%${q}%`;
                let qb = supabaseAdmin
                    .from("ar_invoices")
                    .select("*")
                    .or(`order_id.ilike.${pattern},invoice_number.ilike.${pattern},client_name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern},products.ilike.${pattern}`)
                    .order("order_date", { ascending: false })
                    .limit(200);

                if (currency === "USD") qb = qb.eq("currency", "USD");
                else if (currency === "EUR") qb = qb.eq("currency", "EUR");

                const { data, error } = await qb;
                if (error) throw error;
                return NextResponse.json({ data: data || [] });
            }

            // Fallback: paginated full scan (for suggestions/auto-match)
            const PAGE_SIZE = 1000;
            const maxPages = Math.ceil(limit / PAGE_SIZE);
            const allRows: any[] = [];

            for (let page = 0; page < maxPages; page++) {
                let qb = supabaseAdmin
                    .from("ar_invoices")
                    .select("*")
                    .order("order_date", { ascending: false })
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

                if (currency === "USD") qb = qb.eq("currency", "USD");
                else if (currency === "EUR") qb = qb.eq("currency", "EUR");

                const { data, error } = await qb;
                if (error) throw error;
                if (!data || data.length === 0) break;
                allRows.push(...data);
                if (data.length < PAGE_SIZE) break;
            }
            return NextResponse.json({ data: allRows });
        }

        if (action === "fetch-unreconciled") {
            const { currency, limit = 1000 } = body;
            let qb = supabaseAdmin
                .from("ar_invoices")
                .select("*")
                .eq("reconciled", false)
                .order("order_date", { ascending: false })
                .limit(limit);

            if (currency === "USD") qb = qb.eq("currency", "USD");
            else if (currency === "EUR") qb = qb.eq("currency", "EUR");

            const { data, error } = await qb;
            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        if (action === "fetch-by-ids") {
            const { ids, select = "id, customer_name, order_id, invoice_number, total_amount, charged_amount, financial_account_code, products, currency" } = body;
            if (!ids?.length) return NextResponse.json({ data: [] });
            const { data, error } = await supabaseAdmin
                .from("ar_invoices")
                .select(select)
                .in("id", ids);
            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        if (action === "fetch-by-id") {
            const { id, select = "*" } = body;
            const { data, error } = await supabaseAdmin
                .from("ar_invoices")
                .select(select)
                .eq("id", id)
                .single();
            if (error) throw error;
            return NextResponse.json({ data });
        }

        if (action === "fetch-by-order-id") {
            const { order_id, select = "id, customer_name, order_id, invoice_number, total_amount, charged_amount, financial_account_code, products, currency" } = body;
            const { data, error } = await supabaseAdmin
                .from("ar_invoices")
                .select(select)
                .eq("order_id", order_id);
            if (error) throw error;
            return NextResponse.json({ data: data || [] });
        }

        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    } catch (err: any) {
        console.error("ar-invoices POST error:", err);
        return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
    }
}

/**
 * PATCH /api/ar-invoices
 * Update an ar_invoice record.
 * Body: { id: number, data: Record<string, any> }
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, data: updateData } = body;
        if (!id || !updateData) {
            return NextResponse.json({ error: "Missing id or data" }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from("ar_invoices")
            .update(updateData)
            .eq("id", id)
            .select();

        if (error) throw error;
        return NextResponse.json({ data });
    } catch (err: any) {
        console.error("ar-invoices PATCH error:", err);
        return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
    }
}
