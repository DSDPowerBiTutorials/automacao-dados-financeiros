import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * DELETE /api/drive/delete
 * Body JSON: { bucket, paths: string[] }
 * Remove um ou mais ficheiros de um bucket
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { bucket = "csv_files", paths } = body;

        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return NextResponse.json(
                { success: false, error: "Parâmetro 'paths' é obrigatório (array)" },
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
            .remove(paths);

        if (error) {
            console.error("Error deleting files:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            deleted: data?.length || 0,
        });
    } catch (error) {
        console.error("Error in drive delete:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
