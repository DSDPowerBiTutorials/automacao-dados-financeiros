import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAttachmentRecord, deleteAttachmentRecord, getAttachments } from '@/lib/workstream-api';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
    return createClient(supabaseUrl, supabaseServiceKey);
}

const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
];

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const entityType = formData.get('entity_type') as string;
        const entityId = parseInt(formData.get('entity_id') as string);
        const kind = (formData.get('kind') as string) || 'other';
        const uploadedBy = formData.get('uploaded_by') as string | null;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }
        if (!entityType || !entityId) {
            return NextResponse.json({ success: false, error: 'entity_type and entity_id are required' }, { status: 400 });
        }

        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { success: false, error: `File type not allowed: ${file.type}. Allowed: PDF, images (JPG, PNG, GIF, WEBP, SVG), Excel, Word, CSV` },
                { status: 400 }
            );
        }

        // Validate size
        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { success: false, error: `File too large. Maximum: ${MAX_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // Build storage path
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${entityType}/${entityId}/${timestamp}_${safeName}`;

        // Upload to Supabase Storage
        const sb = getAdminClient();
        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await sb.storage
            .from('ws-attachments')
            .upload(storagePath, arrayBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json(
                { success: false, error: `Upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Insert DB record
        try {
            const record = await createAttachmentRecord({
                entity_type: entityType,
                entity_id: entityId,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                storage_path: storagePath,
                kind,
                uploaded_by: uploadedBy,
            });

            return NextResponse.json({ success: true, data: record });
        } catch (dbError) {
            // Rollback: delete file from storage
            await sb.storage.from('ws-attachments').remove([storagePath]);
            throw dbError;
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to upload attachment';
        console.error('Attachment upload error:', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get('entity_type');
        const entityId = parseInt(searchParams.get('entity_id') || '0');

        if (!entityType || !entityId) {
            return NextResponse.json({ success: false, error: 'entity_type and entity_id are required' }, { status: 400 });
        }

        const data = await getAttachments(entityType, entityId);

        // Generate signed URLs
        const sb = getAdminClient();
        const enriched = await Promise.all(
            (data || []).map(async (att: Record<string, unknown>) => {
                const { data: signedData } = await sb.storage
                    .from('ws-attachments')
                    .createSignedUrl(att.storage_path as string, 3600); // 1h
                return { ...att, url: signedData?.signedUrl || null };
            })
        );

        return NextResponse.json({ success: true, data: enriched });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch attachments';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const record = await deleteAttachmentRecord(id);

        // Remove from storage
        if (record?.storage_path) {
            const sb = getAdminClient();
            await sb.storage.from('ws-attachments').remove([record.storage_path]);
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete attachment';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
