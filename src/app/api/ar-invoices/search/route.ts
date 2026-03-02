import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * POST /api/ar-invoices/search
 * Server-side search for ar_invoices (bypasses RLS).
 * Body: { currency?: string, limit?: number }
 * Returns all ar_invoices matching the currency filter, ordered by order_date desc.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { currency, limit = 5000 } = body;

        const PAGE_SIZE = 1000;
        const maxPages = Math.ceil(limit / PAGE_SIZE);
        const allRows: any[] = [];

        for (let page = 0; page < maxPages; page++) {
            let qb = supabaseAdmin
                .from("ar_invoices")
                .select("*")
                .order("order_date", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            if (currency === "USD") {
                qb = qb.eq("currency", "USD");
            } else if (currency === "EUR") {
                qb = qb.eq("currency", "EUR");
            }

            const { data, error } = await qb;
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < PAGE_SIZE) break;
        }

        return NextResponse.json({ data: allRows });
    } catch (err: any) {
        console.error("ar-invoices search error:", err);
        return NextResponse.json(
            { error: err?.message || "Internal error" },
            { status: 500 }
        );
    }
}
