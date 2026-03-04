import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Cache de buckets já verificados
const verifiedBuckets = new Set<string>();

async function ensureBucket(name: string) {
    if (verifiedBuckets.has(name)) return;
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === name);
    if (!exists) {
        await supabaseAdmin.storage.createBucket(name, {
            public: false,
            fileSizeLimit: 52428800, // 50MB
        });
    }
    verifiedBuckets.add(name);
}

/**
 * GET /api/drive/list?bucket=csv_files&folder=bankinter-eur
 * Lista ficheiros de um bucket do Supabase Storage
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bucket = searchParams.get("bucket") || "csv_files";
        const folder = searchParams.get("folder") || "";
        const limit = parseInt(searchParams.get("limit") || "200");

        // Buckets permitidos
        const allowedBuckets = ["csv_files", "attachments", "ws-attachments"];
        if (!allowedBuckets.includes(bucket)) {
            return NextResponse.json(
                { success: false, error: "Bucket não permitido" },
                { status: 400 }
            );
        }

        // Garantir que o bucket existe
        await ensureBucket(bucket);

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .list(folder, {
                limit,
                offset: 0,
                sortBy: { column: "created_at", order: "desc" },
            });

        if (error) {
            console.error("Error listing files:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        // Filtrar pastas placeholder (.emptyFolderPlaceholder)
        const files = (data || []).filter(
            (f) => f.name !== ".emptyFolderPlaceholder"
        );

        // Separar pastas e ficheiros
        const folders = files.filter((f) => f.id === null);
        const fileItems = files.filter((f) => f.id !== null);

        return NextResponse.json({
            success: true,
            bucket,
            folder,
            folders: folders.map((f) => ({
                name: f.name,
                path: folder ? `${folder}/${f.name}` : f.name,
            })),
            files: fileItems.map((f) => ({
                id: f.id,
                name: f.name,
                path: folder ? `${folder}/${f.name}` : f.name,
                size: f.metadata?.size || 0,
                mimeType: f.metadata?.mimetype || "application/octet-stream",
                createdAt: f.created_at,
                updatedAt: f.updated_at,
            })),
        });
    } catch (error) {
        console.error("Error in drive list:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
