import { NextResponse } from "next/server";
import { getLastSyncTimestamps } from "@/lib/braintree-updater";

export async function GET() {
    try {
        const timestamps = await getLastSyncTimestamps();

        return NextResponse.json({
            success: true,
            timestamps,
        });
    } catch (error: any) {
        console.error("[Braintree Sync Status] Error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to fetch sync status",
            },
            { status: 500 }
        );
    }
}
