import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit: number; allowedMimeTypes?: string[] }> = {
    "csv_files": { public: false, fileSizeLimit: 52428800 },
    "attachments": { public: false, fileSizeLimit: 52428800 },
    "ws-attachments": { public: false, fileSizeLimit: 52428800 },
    "tutorial-videos": { public: true, fileSizeLimit: 52428800, allowedMimeTypes: ["video/mp4", "video/webm"] },
};

const verifiedBuckets = new Set<string>();

async function ensureBucket(name: string) {
    if (verifiedBuckets.has(name)) return;
    const cfg = BUCKET_CONFIG[name] || { public: false, fileSizeLimit: 52428800 };
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const existing = buckets?.find((b) => b.name === name);
    if (!existing) {
        await supabaseAdmin.storage.createBucket(name, cfg);
    } else if (existing.public !== cfg.public) {
        await supabaseAdmin.storage.updateBucket(name, {
            public: cfg.public,
            allowedMimeTypes: cfg.allowedMimeTypes,
        });
    }
    verifiedBuckets.add(name);
}

/**
 * POST /api/drive/upload-url
 * Returns a signed upload URL for direct browser-to-Supabase upload.
 * Body JSON: { bucket, folder?, fileName, contentType }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { bucket, folder, fileName, contentType } = body;

        if (!bucket || !fileName || !contentType) {
            return NextResponse.json(
                { success: false, error: "Campos obrigatórios: bucket, fileName, contentType" },
                { status: 400 }
            );
        }

        const allowedBuckets = Object.keys(BUCKET_CONFIG);
        if (!allowedBuckets.includes(bucket)) {
            return NextResponse.json(
                { success: false, error: "Bucket não permitido" },
                { status: 400 }
            );
        }

        // Validate MIME type for tutorial-videos
        const cfg = BUCKET_CONFIG[bucket];
        if (cfg.allowedMimeTypes && !cfg.allowedMimeTypes.includes(contentType)) {
            return NextResponse.json(
                { success: false, error: `Tipo de ficheiro não permitido. Permitidos: ${cfg.allowedMimeTypes.join(", ")}` },
                { status: 400 }
            );
        }

        await ensureBucket(bucket);

        // Build storage path
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = folder
            ? `${folder}/${timestamp}-${safeName}`
            : `${timestamp}-${safeName}`;

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUploadUrl(storagePath);

        if (error) {
            console.error("Error creating signed upload URL:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            signedUrl: data.signedUrl,
            token: data.token,
            path: storagePath,
        });
    } catch (error) {
        console.error("Error in upload-url:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
