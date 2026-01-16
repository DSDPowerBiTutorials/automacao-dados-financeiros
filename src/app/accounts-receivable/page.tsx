"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Receipt, DollarSign, TrendingUp, AlertCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function AccountsReceivableOverviewPage() {
  return (
    <div className="min-h-full px-6 py-8 space-y-6">
      {/* Header */}
      <header className="page-header-standard">
        <h1 className="header-title">Accounts Receivable Overview</h1>
        <p className="header-subtitle">
          Track customer invoices, payments, and collection activities
        </p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Receivables</p>
                <h3 className="text-2xl font-bold mt-2">€1,245,680</h3>
                <p className="text-sm text-gray-500 mt-1">Outstanding</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Invoices</p>
                <h3 className="text-2xl font-bold mt-2">156</h3>
                <p className="text-sm text-blue-600 mt-1">Pending payment</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl">
                <Receipt className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Customers</p>
                <h3 className="text-2xl font-bold mt-2">1,247</h3>
                <p className="text-sm text-green-600 mt-1">+12% this month</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <h3 className="text-2xl font-bold text-red-600 mt-2">€89,450</h3>
                <p className="text-sm text-red-600 mt-1">23 invoices</p>
              </div>
              <div className="bg-red-50 p-3 rounded-2xl">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="rounded-2xl border-gray-100 shadow-lg">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common accounts receivable tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/accounts-receivable/transactions/invoices">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <Receipt className="h-6 w-6" />
                <span>Create Invoice</span>
              </Button>
            </Link>
            <Link href="/accounts-receivable/transactions/payments">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <DollarSign className="h-6 w-6" />
                <span>Record Payment</span>
              </Button>
            </Link>
            <Link href="/accounts-receivable/master-data/customers">
              <Button variant="outline" className="w-full h-24 flex-col gap-2 rounded-2xl border-2 hover:border-blue-500 hover:shadow-lg transition-all">
                <Users className="h-6 w-6" />
                <span>Manage Customers</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Collection Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Collection Performance</CardTitle>
            <CardDescription>Average collection metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Days Sales Outstanding (DSO)</span>
                <span className="text-2xl font-bold text-blue-600">32 days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Collection Effectiveness</span>
                <span className="text-2xl font-bold text-green-600">94.2%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Average Time to Payment</span>
                <span className="text-2xl font-bold">28 days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Accounts Receivable Aging</CardTitle>
            <CardDescription>Breakdown by payment terms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Current (0-30 days)</span>
                  <span className="font-bold">€896,230</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-green-600 h-2.5 rounded-full" style={{ width: "72%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>1-30 days past due</span>
                  <span className="font-bold">€210,000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: "17%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>31-60 days past due</span>
                  <span className="font-bold">€50,000</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-orange-500 h-2.5 rounded-full" style={{ width: "4%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Over 60 days</span>
                  <span className="font-bold text-red-600">€89,450</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-red-600 h-2.5 rounded-full" style={{ width: "7%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest customer invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
                  <div>
                    <p className="font-medium">INV-2025-{3200 + i}</p>
                    <p className="text-sm text-gray-600">Customer {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{[5240.80, 8950.50, 3820.25, 11200.90][i - 1]}</p>
                    <p className="text-xs text-gray-500">Issued: Dec {18 + i}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
            <CardDescription>Latest payments received</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border-2 rounded-2xl bg-green-50 hover:border-green-500 hover:shadow-md transition-all">
                  <div>
                    <p className="font-medium">Payment #{5400 + i}</p>
                    <p className="text-sm text-gray-600">Customer {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">€{[4820.50, 6950.75, 2340.25, 8100.90][i - 1]}</p>
                    <p className="text-xs text-gray-500">Received: Dec {19 + i}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Channels Summary */}
      <Card className="rounded-2xl border-gray-100 shadow-lg">
        <CardHeader>
          <CardTitle>Revenue by Payment Channel</CardTitle>
          <CardDescription>This month&apos;s collections breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
              <p className="text-sm text-gray-600">Stripe</p>
              <p className="text-xl font-bold mt-1">€485,200</p>
              <p className="text-xs text-green-600 mt-1">+15.2%</p>
            </div>
            <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
              <p className="text-sm text-gray-600">Braintree</p>
              <p className="text-xl font-bold mt-1">€320,150</p>
              <p className="text-xs text-green-600 mt-1">+8.7%</p>
            </div>
            <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
              <p className="text-sm text-gray-600">GoCardless</p>
              <p className="text-xl font-bold mt-1">€256,890</p>
              <p className="text-xs text-green-600 mt-1">+12.3%</p>
            </div>
            <div className="p-4 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
              <p className="text-sm text-gray-600">PayPal</p>
              <p className="text-xl font-bold mt-1">€183,440</p>
              <p className="text-xs text-green-600 mt-1">+5.4%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
