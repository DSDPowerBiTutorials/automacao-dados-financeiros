import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Increase max duration for file uploads
export const maxDuration = 30;

// Cache de buckets já verificados (evita chamadas repetidas)
const verifiedBuckets = new Set<string>();

const BUCKET_CONFIG: Record<string, { public: boolean; fileSizeLimit: number; allowedMimeTypes?: string[] }> = {
    "csv_files":       { public: false, fileSizeLimit: 52428800 },
    "attachments":     { public: false, fileSizeLimit: 52428800 },
    "ws-attachments":  { public: false, fileSizeLimit: 52428800 },
    "tutorial-videos": { public: true,  fileSizeLimit: 209715200, allowedMimeTypes: ["video/mp4", "video/webm"] },
};

async function ensureBucket(name: string) {
    if (verifiedBuckets.has(name)) return;
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === name);
    if (!exists) {
        const cfg = BUCKET_CONFIG[name] || { public: false, fileSizeLimit: 52428800 };
        await supabaseAdmin.storage.createBucket(name, cfg);
    }
    verifiedBuckets.add(name);
}

/**
 * POST /api/drive/upload
 * Upload de ficheiro para um bucket Supabase Storage
 * FormData: file, bucket (optional), folder (optional)
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const bucket = (formData.get("bucket") as string) || "csv_files";
        const folder = (formData.get("folder") as string) || "";

        if (!file) {
            return NextResponse.json(
                { success: false, error: "Nenhum ficheiro enviado" },
                { status: 400 }
            );
        }

        const allowedBuckets = ["csv_files", "attachments", "ws-attachments", "tutorial-videos"];
        if (!allowedBuckets.includes(bucket)) {
            return NextResponse.json(
                { success: false, error: "Bucket não permitido" },
                { status: 400 }
            );
        }

        // Garantir que o bucket existe
        await ensureBucket(bucket);

        // Validar tamanho (depende do bucket)
        const maxSize = bucket === "tutorial-videos" ? 200 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { success: false, error: `Ficheiro demasiado grande. Máximo ${maxSize / (1024 * 1024)}MB.` },
                { status: 400 }
            );
        }

        // Sanitizar nome do ficheiro
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = folder
            ? `${folder}/${timestamp}-${safeName}`
            : `${timestamp}-${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .upload(storagePath, buffer, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            });

        if (error) {
            console.error("Error uploading file:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            file: {
                name: file.name,
                path: data.path,
                bucket,
                size: file.size,
                mimeType: file.type,
            },
        });
    } catch (error) {
        console.error("Error in drive upload:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
