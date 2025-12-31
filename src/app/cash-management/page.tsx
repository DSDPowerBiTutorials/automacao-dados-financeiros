"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CreditCard, CheckCircle2, TrendingUp, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import Link from "next/link";

export default function CashManagementOverviewPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cash Management</h1>
        <p className="text-gray-600 mt-1">
          Monitor bank accounts, payment channels, and cash flow
        </p>
      </div>

      {/* Cash Position */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cash</p>
                <h3 className="text-2xl font-bold mt-2">€823,450</h3>
                <p className="text-sm text-green-600 mt-1">All accounts</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today&apos;s Inflow</p>
                <h3 className="text-2xl font-bold text-green-600 mt-2">€45,680</h3>
                <p className="text-sm text-gray-500 mt-1">32 transactions</p>
              </div>
              <div className="bg-green-50 p-3 rounded-2xl">
                <ArrowDownCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today&apos;s Outflow</p>
                <h3 className="text-2xl font-bold text-red-600 mt-2">€38,250</h3>
                <p className="text-sm text-gray-500 mt-1">24 transactions</p>
              </div>
              <div className="bg-red-50 p-3 rounded-2xl">
                <ArrowUpCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Change</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-2">+€7,430</h3>
                <p className="text-sm text-green-600 font-medium mt-1">Today</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts */}
      <Card className="rounded-2xl border-gray-100 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bank Accounts</CardTitle>
              <CardDescription>Current balances across all bank accounts</CardDescription>
            </div>
            <Link href="/cash-management/bank-statements">
              <Button>View All Statements</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/reports/bankinter-eur">
              <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="text-xs text-gray-500">EUR</span>
                </div>
                <p className="font-medium">Bankinter EUR</p>
                <p className="text-2xl font-bold mt-1">€458,230</p>
                <p className="text-xs text-green-600 mt-1">+€12,450 today</p>
              </div>
            </Link>

            <Link href="/reports/bankinter-usd">
              <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <span className="text-xs text-gray-500">USD</span>
                </div>
                <p className="font-medium">Bankinter USD</p>
                <p className="text-2xl font-bold mt-1">$185,420</p>
                <p className="text-xs text-green-600 mt-1">+$5,680 today</p>
              </div>
            </Link>

            <Link href="/reports/sabadell">
              <div className="p-4 border-2 rounded-2xl hover:border-purple-500 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Building2 className="h-5 w-5 text-purple-600" />
                  <span className="text-xs text-gray-500">EUR</span>
                </div>
                <p className="font-medium">Sabadell</p>
                <p className="text-2xl font-bold mt-1">€179,800</p>
                <p className="text-xs text-red-600 mt-1">-€10,520 today</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Payment Channels */}
      <Card className="rounded-2xl border-gray-100 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Payment Channels</CardTitle>
              <CardDescription>Revenue collected through online payment platforms</CardDescription>
            </div>
            <Link href="/cash-management/payment-channels">
              <Button variant="outline" className="rounded-2xl">View All Channels</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Link href="/reports/stripe">
                <div className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-2xl">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Stripe</p>
                      <p className="text-xs text-gray-500">Last sync: 2 min ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€485,200</p>
                    <p className="text-xs text-green-600">+€15,680 today</p>
                  </div>
                </div>
              </Link>

              <Link href="/reports/braintree">
                <div className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-purple-500 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-50 p-2 rounded-2xl">
                      <CreditCard className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Braintree</p>
                      <p className="text-xs text-gray-500">Last sync: 5 min ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€320,150</p>
                    <p className="text-xs text-green-600">+€8,920 today</p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="space-y-3">
              <Link href="/reports/gocardless">
                <div className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-green-500 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-50 p-2 rounded-2xl">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">GoCardless</p>
                      <p className="text-xs text-gray-500">Last sync: 10 min ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€256,890</p>
                    <p className="text-xs text-green-600">+€12,340 today</p>
                  </div>
                </div>
              </Link>

              <Link href="/reports/paypal">
                <div className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-2xl">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">PayPal</p>
                      <p className="text-xs text-gray-500">Last sync: 15 min ago</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€183,440</p>
                    <p className="text-xs text-green-600">+€5,230 today</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardContent className="p-6">
            <Link href="/actions/reconciliation-center">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <CheckCircle2 className="h-8 w-8" />
                <span>Reconciliation Center</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardContent className="p-6">
            <Link href="/cash-management">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <TrendingUp className="h-8 w-8" />
                <span>Cash Flow Reports</span>
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardContent className="p-6">
            <Link href="/executive/cash-flow">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <ArrowDownCircle className="h-8 w-8" />
                <span>Cash Flow Forecast</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
