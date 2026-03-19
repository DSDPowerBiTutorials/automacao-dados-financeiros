import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const ALLOWED_BUCKETS = ["csv_files", "attachments", "ws-attachments", "tutorial-videos"];
const PUBLIC_BUCKETS = ["tutorial-videos"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * GET /api/share?bucket=tutorial-videos&path=file.mp4
 * Public endpoint — no auth required.
 * Redirects to the file (public URL or signed URL for private buckets).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get("bucket");
    const filePath = searchParams.get("path");

    if (!bucket || !filePath) {
        return NextResponse.json(
            { error: "Parâmetros 'bucket' e 'path' são obrigatórios" },
            { status: 400 }
        );
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
        return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    // Prevent path traversal
    if (filePath.includes("..")) {
        return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
    }

    // Public buckets: redirect to direct public URL
    if (PUBLIC_BUCKETS.includes(bucket)) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(filePath)}`;
        return NextResponse.redirect(publicUrl, 302);
    }

    // Private buckets: generate signed URL (7 days = 604800s)
    const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(filePath, 604800);

    if (error) {
        console.error("[share] Signed URL error:", error.message);
        return NextResponse.json({ error: "Ficheiro não encontrado" }, { status: 404 });
    }

    return NextResponse.redirect(data.signedUrl, 302);
}
