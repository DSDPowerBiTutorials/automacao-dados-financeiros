/**
 * QuickBooks OAuth2 Callback Endpoint
 * 
 * Handles the callback from QuickBooks after user authorization
 * Exchanges authorization code for access tokens
 */

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, storeTokens } from "@/lib/quickbooks"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const code = searchParams.get("code")
        const realmId = searchParams.get("realmId")
        const state = searchParams.get("state")
        const error = searchParams.get("error")

        console.log("📥 QuickBooks callback received")
        console.log("   State:", state)
        console.log("   RealmId:", realmId)
        console.log("   Code:", code ? "✓ Present" : "❌ Missing")

        // Check for errors
        if (error) {
            console.error("❌ QuickBooks authorization error:", error)
            return NextResponse.redirect(
                new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, request.url)
            )
        }

        // Validate required parameters
        if (!code || !realmId) {
            console.error("❌ Missing required parameters")
            return NextResponse.redirect(
                new URL("/settings/integrations?error=missing_parameters", request.url)
            )
        }

        // Exchange code for tokens
        console.log("🔄 Exchanging authorization code for tokens...")
        const tokens = await exchangeCodeForTokens(code, realmId)

        // Store tokens in database
        console.log("💾 Storing tokens in database...")
        await storeTokens(tokens)

        console.log("✅ QuickBooks connected successfully!")
        console.log("   Realm ID:", realmId)

        // Redirect to success page
        return NextResponse.redirect(
            new URL("/settings/integrations?quickbooks=connected", request.url)
        )

    } catch (error) {
        console.error("❌ QuickBooks callback error:", error)
        return NextResponse.redirect(
            new URL(`/settings/integrations?error=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`, request.url)
        )
    }
}
