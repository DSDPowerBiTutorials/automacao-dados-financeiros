/**
 * Customer CRUD API
 * 
 * GET  /api/customers  → List all customers
 * POST /api/customers  → Create or update a customer
 * DELETE /api/customers?code=XX → Delete a customer
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from("customers")
            .select("*")
            .order("name");

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: any) {
        console.error("Customers GET error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { customer, isUpdate } = body;

        if (!customer || !customer.name || !customer.country) {
            return NextResponse.json(
                { success: false, error: "Name and Country are required" },
                { status: 400 }
            );
        }

        if (isUpdate && customer.code) {
            const { error } = await supabaseAdmin
                .from("customers")
                .update({
                    ...customer,
                    updated_at: new Date().toISOString(),
                })
                .eq("code", customer.code);

            if (error) throw error;
            return NextResponse.json({ success: true, message: "Customer updated" });
        } else {
            // Generate code
            const { data: maxCode } = await supabaseAdmin
                .from("customers")
                .select("code")
                .like("code", `${customer.country}-CU%`)
                .order("code", { ascending: false })
                .limit(1);

            let nextNum = 1;
            if (maxCode && maxCode.length > 0) {
                const match = maxCode[0].code.match(/-CU(\d+)$/);
                if (match) nextNum = parseInt(match[1]) + 1;
            }
            const code = `${customer.country}-CU${String(nextNum).padStart(5, "0")}`;

            const { error } = await supabaseAdmin
                .from("customers")
                .insert({
                    ...customer,
                    code,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });

            if (error) throw error;
            return NextResponse.json({ success: true, message: "Customer created", code });
        }
    } catch (error: any) {
        console.error("Customers POST error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.json(
                { success: false, error: "code parameter is required" },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from("customers")
            .delete()
            .eq("code", code);

        if (error) throw error;
        return NextResponse.json({ success: true, message: "Customer deleted" });
    } catch (error: any) {
        console.error("Customers DELETE error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
