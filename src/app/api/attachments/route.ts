import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const BUCKET_NAME = "attachments";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const file = formData.get('file') as File;
        const entityType = formData.get('entity_type') as string || 'invoice';
        const entityId = formData.get('entity_id') as string;
        const batchId = formData.get('batch_id') as string;
        const kind = formData.get('kind') as string || 'invoice_pdf';
        const invoiceDate = formData.get('invoice_date') as string;
        const userId = formData.get('user_id') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only PDF, JPG, PNG allowed.' }, { status: 400 });
        }

        // Validate file size (20MB max)
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json({ error: 'File too large. Maximum 20MB.' }, { status: 400 });
        }

        // Determine folder path based on invoice date
        let folderPath = 'invoices/_drafts';
        if (invoiceDate) {
            const date = new Date(invoiceDate);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            folderPath = `invoices/${year}/${month}`;
        } else if (batchId) {
            folderPath = `invoices/_drafts/${batchId}`;
        }

        // Generate safe filename
        const timestamp = Date.now();
        const safeFileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storagePath = `${folderPath}/${safeFileName}`;

        // Upload to Supabase Storage
        const fileBuffer = await file.arrayBuffer();
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
                contentType: file.type,
                upsert: false
            });

        if (uploadError) {
            console.error('Supabase Storage upload error:', uploadError);
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

        const webUrl = urlData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;

        // Save to database
        const { data: attachment, error: dbError } = await supabaseAdmin
            .from('attachments')
            .insert({
                entity_type: entityType,
                entity_id: entityId ? parseInt(entityId) : null,
                batch_id: batchId || null,
                kind,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                storage_provider: 'supabase',
                storage_path: storagePath,
                web_url: webUrl,
                created_by: userId || null
            })
            .select()
            .single();

        if (dbError) {
            // Rollback: delete uploaded file
            await supabaseAdmin.storage.from(BUCKET_NAME).remove([storagePath]);
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            attachment
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({
            error: error.message || 'Upload failed'
        }, { status: 500 });
    }
}

// GET: List attachments for an entity
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get('entity_type');
        const entityId = searchParams.get('entity_id');
        const batchId = searchParams.get('batch_id');

        let query = supabaseAdmin.from('attachments').select('*');

        if (entityType && entityId) {
            query = query.eq('entity_type', entityType).eq('entity_id', parseInt(entityId));
        } else if (batchId) {
            query = query.eq('batch_id', batchId);
        } else {
            return NextResponse.json({ error: 'entity_id or batch_id required' }, { status: 400 });
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        // Generate signed URLs for private files
        const attachmentsWithUrls = await Promise.all(
            (data || []).map(async (att) => {
                if (att.storage_path) {
                    const { data: signedUrlData } = await supabaseAdmin.storage
                        .from(BUCKET_NAME)
                        .createSignedUrl(att.storage_path, 3600); // 1 hour expiry
                    return { ...att, signed_url: signedUrlData?.signedUrl || att.web_url };
                }
                return att;
            })
        );

        return NextResponse.json({ attachments: attachmentsWithUrls });

    } catch (error: any) {
        console.error('List attachments error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Remove attachment
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 });
        }

        // Get attachment info
        const { data: attachment } = await supabaseAdmin
            .from('attachments')
            .select('*')
            .eq('id', id)
            .single();

        if (!attachment) {
            return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
        }

        // Delete from Supabase Storage
        if (attachment.storage_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from(BUCKET_NAME)
                .remove([attachment.storage_path]);

            if (storageError) {
                console.error('Storage delete error:', storageError);
            }
        }

        // Delete from database
        const { error } = await supabaseAdmin
            .from('attachments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete attachment error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
