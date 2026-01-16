/**
 * QuickBooks Disconnect Endpoint
 * Revokes tokens and disconnects the integration
 * Required for QuickBooks production compliance
 */

import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

const QUICKBOOKS_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke"

export async function POST() {
    try {
        console.log("🔌 Starting QuickBooks disconnect...")

        if (!supabaseAdmin) {
            throw new Error("Supabase not configured")
        }

        // Get current tokens
        const { data: tokenData, error: fetchError } = await supabaseAdmin
            .from("quickbooks_tokens")
            .select("*")
            .eq("id", "default")
            .single()

        if (fetchError || !tokenData) {
            console.log("ℹ️ No QuickBooks connection found")
            return NextResponse.json({
                success: true,
                message: "No QuickBooks connection to disconnect"
            })
        }

        // Revoke token at QuickBooks
        if (tokenData.refresh_token) {
            const clientId = process.env.QUICKBOOKS_CLIENT_ID
            const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET

            if (clientId && clientSecret) {
                const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

                try {
                    const revokeResponse = await fetch(QUICKBOOKS_REVOKE_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            "Authorization": `Basic ${credentials}`
                        },
                        body: new URLSearchParams({
                            token: tokenData.refresh_token
                        })
                    })

                    if (revokeResponse.ok) {
                        console.log("✅ Token revoked at QuickBooks")
                    } else {
                        console.warn("⚠️ Token revocation returned:", revokeResponse.status)
                    }
                } catch (revokeError) {
                    console.warn("⚠️ Token revocation failed (continuing):", revokeError)
                }
            }
        }

        // Delete tokens from database
        const { error: deleteError } = await supabaseAdmin
            .from("quickbooks_tokens")
            .delete()
            .eq("id", "default")

        if (deleteError) {
            console.error("❌ Error deleting tokens:", deleteError)
            throw deleteError
        }

        console.log("✅ QuickBooks disconnected successfully")

        return NextResponse.json({
            success: true,
            message: "QuickBooks disconnected successfully"
        })

    } catch (error) {
        console.error("❌ QuickBooks disconnect error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Disconnect failed" },
            { status: 500 }
        )
    }
}

export async function GET() {
    return NextResponse.json({
        endpoint: "QuickBooks Disconnect",
        description: "POST to this endpoint to disconnect QuickBooks integration",
        method: "POST"
    })
}
