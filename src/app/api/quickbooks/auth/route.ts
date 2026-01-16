/**
 * QuickBooks OAuth2 Authorization Endpoint
 * 
 * Redirects user to QuickBooks for authorization
 */

import { NextRequest, NextResponse } from "next/server"
import { getAuthorizationUrl } from "@/lib/quickbooks"

export async function GET(request: NextRequest) {
    try {
        console.log("🔗 Starting QuickBooks OAuth2 flow...")

        // Generate a random state for security
        const state = Math.random().toString(36).substring(2, 15)

        // Get the authorization URL
        const authUrl = getAuthorizationUrl(state)

        console.log("📤 Redirecting to QuickBooks authorization...")

        // Redirect to QuickBooks
        return NextResponse.redirect(authUrl)

    } catch (error) {
        console.error("❌ QuickBooks auth error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}
