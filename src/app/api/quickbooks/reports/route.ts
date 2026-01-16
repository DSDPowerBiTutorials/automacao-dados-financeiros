/**
 * QuickBooks Reports Endpoint
 * 
 * Get financial reports from QuickBooks
 */

import { NextRequest, NextResponse } from "next/server"
import {
    testConnection,
    getProfitAndLossReport,
    getBalanceSheetReport,
    getInvoices,
    getPayments,
    getAllAccounts
} from "@/lib/quickbooks"

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const reportType = searchParams.get("type") || "summary"
        const startDate = searchParams.get("start") || getFirstDayOfMonth()
        const endDate = searchParams.get("end") || getTodayDate()

        console.log(`📊 QuickBooks report request: ${reportType}`)
        console.log(`   Date range: ${startDate} to ${endDate}`)

        // Test connection first
        const connectionTest = await testConnection()
        if (!connectionTest.connected) {
            return NextResponse.json({
                success: false,
                error: "Not connected to QuickBooks"
            }, { status: 401 })
        }

        let report: any

        switch (reportType) {
            case "pnl":
            case "profit-and-loss":
                report = await getProfitAndLossReport(startDate, endDate)
                break

            case "balance-sheet":
                report = await getBalanceSheetReport(endDate)
                break

            case "invoices":
                const invoices = await getInvoices(startDate, endDate)
                report = {
                    type: "invoices",
                    count: invoices.length,
                    total: invoices.reduce((sum, inv) => sum + inv.TotalAmt, 0),
                    unpaid: invoices.filter(inv => inv.Balance > 0).length,
                    data: invoices
                }
                break

            case "payments":
                const payments = await getPayments(startDate, endDate)
                report = {
                    type: "payments",
                    count: payments.length,
                    total: payments.reduce((sum, pmt) => sum + pmt.TotalAmt, 0),
                    data: payments
                }
                break

            case "accounts":
                const accounts = await getAllAccounts()
                report = {
                    type: "accounts",
                    count: accounts.length,
                    data: accounts
                }
                break

            case "summary":
            default:
                // Get summary of all data
                const [allInvoices, allPayments, allAccounts] = await Promise.all([
                    getInvoices(startDate, endDate),
                    getPayments(startDate, endDate),
                    getAllAccounts()
                ])

                report = {
                    type: "summary",
                    company: connectionTest.company,
                    period: { startDate, endDate },
                    invoices: {
                        count: allInvoices.length,
                        total: allInvoices.reduce((sum, inv) => sum + inv.TotalAmt, 0),
                        unpaid: allInvoices.filter(inv => inv.Balance > 0).reduce((sum, inv) => sum + inv.Balance, 0)
                    },
                    payments: {
                        count: allPayments.length,
                        total: allPayments.reduce((sum, pmt) => sum + pmt.TotalAmt, 0)
                    },
                    accounts: {
                        total: allAccounts.length,
                        bank: allAccounts.filter(a => a.AccountType === "Bank").length,
                        expense: allAccounts.filter(a => a.AccountType === "Expense").length,
                        income: allAccounts.filter(a => a.AccountType === "Income").length
                    }
                }
                break
        }

        return NextResponse.json({
            success: true,
            report
        })

    } catch (error) {
        console.error("❌ QuickBooks report error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        )
    }
}

function getFirstDayOfMonth(): string {
    const date = new Date()
    date.setDate(1)
    return date.toISOString().split("T")[0]
}

function getTodayDate(): string {
    return new Date().toISOString().split("T")[0]
}
