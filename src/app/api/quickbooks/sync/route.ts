/**
 * QuickBooks Sync Endpoint
 * 
 * Syncs data from QuickBooks to our database
 */

import { NextRequest, NextResponse } from "next/server"
import {
    testConnection,
    getCompanyInfo,
    syncInvoicesToDatabase,
    syncPaymentsToDatabase,
    syncBillsToDatabase,
    syncExpensesToDatabase,
    syncDepositsToDatabase,
    syncTransfersToDatabase,
    syncCustomersToDatabase,
    syncVendorsToDatabase,
    syncAccountsToDatabase,
    getBankAccounts,
    getInvoices,
    getPayments,
    syncAllQuickBooksData
} from "@/lib/quickbooks"

export async function GET(request: NextRequest) {
    try {
        // Test connection and get company info
        const connectionTest = await testConnection()

        if (!connectionTest.connected) {
            return NextResponse.json({
                success: false,
                connected: false,
                error: connectionTest.error || "Not connected to QuickBooks"
            }, { status: 401 })
        }

        return NextResponse.json({
            success: true,
            connected: true,
            company: connectionTest.company,
            message: "QuickBooks is connected. Use POST to sync data."
        })

    } catch (error) {
        console.error("❌ QuickBooks status error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log("🚀 Starting QuickBooks sync...")

        // Parse request body
        let startDate: string | undefined
        let syncType: string = "all"

        try {
            const body = await request.json()
            startDate = body.startDate
            syncType = body.syncType || "all"
        } catch {
            // No body provided, use defaults
            const searchParams = request.nextUrl.searchParams
            startDate = searchParams.get("since") || undefined
            syncType = searchParams.get("type") || "all"
        }

        // Default to last 30 days if no start date
        if (!startDate) {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            startDate = thirtyDaysAgo.toISOString().split("T")[0]
        }

        console.log(`📅 Syncing from: ${startDate}`)
        console.log(`📋 Sync type: ${syncType}`)

        // Test connection first
        const connectionTest = await testConnection()
        if (!connectionTest.connected) {
            return NextResponse.json({
                success: false,
                error: "Not connected to QuickBooks. Please authorize first at /api/quickbooks/auth"
            }, { status: 401 })
        }

        const results: {
            company: any
            invoices?: { count: number }
            payments?: { count: number }
            bills?: { count: number }
            expenses?: { count: number }
            deposits?: { count: number }
            transfers?: { count: number }
            customers?: { count: number }
            vendors?: { count: number }
            accounts?: { count: number }
            bankAccounts?: any[]
        } = {
            company: connectionTest.company
        }

        // Sync based on type
        if (syncType === "all") {
            console.log("🔄 Running full sync...")
            const fullSync = await syncAllQuickBooksData(startDate)
            return NextResponse.json({
                success: fullSync.success,
                syncedFrom: startDate,
                ...fullSync
            })
        }

        if (syncType === "invoices") {
            console.log("📄 Syncing invoices...")
            results.invoices = await syncInvoicesToDatabase(startDate)
        }

        if (syncType === "payments") {
            console.log("💰 Syncing payments...")
            results.payments = await syncPaymentsToDatabase(startDate)
        }

        if (syncType === "bills") {
            console.log("📋 Syncing bills...")
            results.bills = await syncBillsToDatabase(startDate)
        }

        if (syncType === "expenses") {
            console.log("💸 Syncing expenses...")
            results.expenses = await syncExpensesToDatabase(startDate)
        }

        if (syncType === "bank" || syncType === "deposits") {
            console.log("🏦 Syncing deposits...")
            results.deposits = await syncDepositsToDatabase(startDate)
        }

        if (syncType === "bank" || syncType === "transfers") {
            console.log("🔄 Syncing transfers...")
            results.transfers = await syncTransfersToDatabase(startDate)
        }

        if (syncType === "accounts") {
            console.log("📊 Syncing accounts...")
            results.accounts = await syncAccountsToDatabase()
            results.bankAccounts = await getBankAccounts()
        }

        if (syncType === "customers") {
            console.log("👥 Syncing customers...")
            results.customers = await syncCustomersToDatabase()
        }

        if (syncType === "vendors") {
            console.log("🏢 Syncing vendors...")
            results.vendors = await syncVendorsToDatabase()
        }

        console.log("✅ QuickBooks sync completed!")

        return NextResponse.json({
            success: true,
            syncedFrom: startDate,
            ...results
        })

    } catch (error) {
        console.error("❌ QuickBooks sync error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}
