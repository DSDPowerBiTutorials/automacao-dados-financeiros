// API: Criar/Buscar vínculos Order ↔ Transaction
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { order_id, transaction_id, source = "manual" } = body;

        if (!order_id || !transaction_id) {
            return NextResponse.json(
                { success: false, error: "order_id and transaction_id are required" },
                { status: 400 }
            );
        }

        // Verificar se já existe
        const { data: existing } = await supabaseAdmin
            .from("order_transaction_mapping")
            .select("*")
            .eq("transaction_id", transaction_id)
            .single();

        if (existing) {
            return NextResponse.json({
                success: true,
                data: existing,
                message: "Mapping already exists",
            });
        }

        // Criar novo mapeamento
        const { data, error } = await supabaseAdmin
            .from("order_transaction_mapping")
            .insert({
                order_id,
                transaction_id,
                source,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
            message: "Mapping created successfully",
        });
    } catch (error: any) {
        console.error("[API Order Mapping] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const transaction_id = searchParams.get("transaction_id");
        const order_id = searchParams.get("order_id");

        if (!transaction_id && !order_id) {
            return NextResponse.json(
                { success: false, error: "transaction_id or order_id required" },
                { status: 400 }
            );
        }

        let query = supabaseAdmin.from("order_transaction_mapping").select("*");

        if (transaction_id) {
            query = query.eq("transaction_id", transaction_id);
        } else if (order_id) {
            query = query.eq("order_id", order_id);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: data || [],
        });
    } catch (error: any) {
        console.error("[API Order Mapping] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// Buscar múltiplos de uma vez (batch)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { transaction_ids } = body;

        if (!transaction_ids || !Array.isArray(transaction_ids)) {
            return NextResponse.json(
                { success: false, error: "transaction_ids array required" },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from("order_transaction_mapping")
            .select("*")
            .in("transaction_id", transaction_ids);

        if (error) throw error;

        // Transformar em Map para acesso rápido
        const mappings = new Map();
        (data || []).forEach((mapping) => {
            mappings.set(mapping.transaction_id, mapping.order_id);
        });

        return NextResponse.json({
            success: true,
            data: mappings,
            count: data?.length || 0,
        });
    } catch (error: any) {
        console.error("[API Order Mapping Batch] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
