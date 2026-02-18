"use client"

import React from "react"
import Link from "next/link"
import { ArrowLeft, Building2, CreditCard, TrendingUp, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ChaseQuickBooksPage() {
    return (
        <div className="min-h-full">
            <header className="page-header-standard">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/cash-management/bank-statements">
                            <Button variant="ghost" size="sm" className="gap-2 text-gray-900 dark:text-white hover:bg-white/10">
                                <ArrowLeft className="h-4 w-4" />
                                Back
                            </Button>
                        </Link>
                        <div>
                            <h1 className="header-title flex items-center gap-2">
                                <span className="text-2xl">🇺🇸</span>
                                Chase Bank - QuickBooks
                            </h1>
                            <p className="header-subtitle">
                                Bank statements synced from QuickBooks Online
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Chase Business Checking */}
                    <Link href="/cash-management/chase-quickbooks/business-checking">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-[#117ACA]">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#117ACA]/10 p-3 rounded-lg">
                                        <Building2 className="h-8 w-8 text-[#117ACA]" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Chase Business Checking</CardTitle>
                                        <CardDescription>Business checking account</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Currency</span>
                                    <span className="font-semibold">USD ($)</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-gray-500">Source</span>
                                    <span className="font-semibold text-[#117ACA]">QuickBooks Online</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>

                    {/* Chase Savings */}
                    <Link href="/cash-management/chase-quickbooks/savings">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-[#117ACA]">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#117ACA]/10 p-3 rounded-lg">
                                        <TrendingUp className="h-8 w-8 text-[#117ACA]" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Chase Savings</CardTitle>
                                        <CardDescription>Savings account</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Currency</span>
                                    <span className="font-semibold">USD ($)</span>
                                </div>
                                <div className="flex items-center justify-between text-sm mt-2">
                                    <span className="text-gray-500">Source</span>
                                    <span className="font-semibold text-[#117ACA]">QuickBooks Online</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </div>

                {/* Info Card */}
                <Card className="mt-8 bg-blue-50 border-blue-200">
                    <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                            <div className="bg-blue-100 p-2 rounded-full">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-blue-900">Auto Sync</h3>
                                <p className="text-sm text-blue-700 mt-1">
                                    Bank statements are automatically synced from QuickBooks Online.
                                    Includes deposits, transfers, and transactions from Chase accounts.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
