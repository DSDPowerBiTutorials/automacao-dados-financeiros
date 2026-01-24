import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Create new batch
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { user_id } = body;

        const { data: batch, error } = await supabaseAdmin
            .from('attachment_batches')
            .insert({
                status: 'open',
                created_by: user_id || null
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            batch_id: batch.id
        });

    } catch (error: any) {
        console.error('Create batch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Link batch to entity
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { batch_id, entity_type, entity_id } = body;

        if (!batch_id || !entity_type || !entity_id) {
            return NextResponse.json({
                error: 'batch_id, entity_type, and entity_id required'
            }, { status: 400 });
        }

        // Update batch
        const { error: batchError } = await supabaseAdmin
            .from('attachment_batches')
            .update({
                status: 'linked',
                linked_entity_type: entity_type,
                linked_entity_id: entity_id,
                linked_at: new Date().toISOString()
            })
            .eq('id', batch_id);

        if (batchError) throw batchError;

        // Update attachments
        const { error: attachError } = await supabaseAdmin
            .from('attachments')
            .update({
                entity_type,
                entity_id,
                updated_at: new Date().toISOString()
            })
            .eq('batch_id', batch_id);

        if (attachError) throw attachError;

        // Auto-update invoice_status when batch linked to invoice
        if (entity_type === 'invoice' && entity_id) {
            await supabaseAdmin
                .from('invoices')
                .update({
                    invoice_status: 'available',
                    invoice_status_changed_at: new Date().toISOString()
                })
                .eq('id', parseInt(entity_id));
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Link batch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
