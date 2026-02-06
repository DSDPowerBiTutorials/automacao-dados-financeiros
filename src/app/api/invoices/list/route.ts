import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
    try {
        // Use supabaseAdmin (service role) to bypass the 1000-row API limit
        let allData: any[] = [];
        let offset = 0;
        const pageSize = 5000;

        while (true) {
            const { data, error } = await supabaseAdmin
                .from("invoices")
                .select("*")
                .order("invoice_date", { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error("Error fetching invoices:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            if (!data || data.length === 0) break;

            allData = allData.concat(data);
            offset += pageSize;

            if (data.length < pageSize) break;
        }

        console.log(`📋 Invoices API: ${allData.length} invoices loaded`);

        return NextResponse.json({ data: allData, count: allData.length });
    } catch (e: any) {
        console.error("Error in invoices list API:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
