import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/drive/download?bucket=csv_files&path=bankinter-eur/file.csv
 * Gera uma signed URL temporária (1h) para download
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const bucket = searchParams.get("bucket") || "csv_files";
        const filePath = searchParams.get("path");

        if (!filePath) {
            return NextResponse.json(
                { success: false, error: "Parâmetro 'path' é obrigatório" },
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

        const { data, error } = await supabaseAdmin.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600); // 1 hora

        if (error) {
            console.error("Error creating signed URL:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            url: data.signedUrl,
            expiresIn: 3600,
        });
    } catch (error) {
        console.error("Error in drive download:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
