"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, Clock, TrendingDown, AlertCircle, DollarSign } from "lucide-react";
import Link from "next/link";

export default function AccountsPayableOverviewPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Accounts Payable Overview</h1>
        <p className="text-gray-600 mt-1">
          Manage supplier invoices, payments, and vendor relationships
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payables</p>
                <h3 className="text-2xl font-bold mt-2">€485,230</h3>
                <p className="text-sm text-gray-500 mt-1">Outstanding</p>
              </div>
              <div className="bg-red-50 p-3 rounded-2xl">
                <DollarSign className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Invoices</p>
                <h3 className="text-2xl font-bold mt-2">47</h3>
                <p className="text-sm text-orange-600 mt-1">Awaiting approval</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-2xl">
                <FileText className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Vendors</p>
                <h3 className="text-2xl font-bold mt-2">219</h3>
                <p className="text-sm text-blue-600 mt-1">Registered</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <h3 className="text-2xl font-bold text-red-600 mt-2">€45,820</h3>
                <p className="text-sm text-red-600 mt-1">12 invoices</p>
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
          <CardDescription>Common accounts payable tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/accounts-payable/invoices">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <FileText className="h-6 w-6" />
                <span>New Invoice</span>
              </Button>
            </Link>
            <Link href="/accounts-payable/transactions/payments">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <DollarSign className="h-6 w-6" />
                <span>Process Payment</span>
              </Button>
            </Link>
            <Link href="/accounts-payable/transactions/bank-reconciliation">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <FileText className="h-6 w-6" />
                <span>Bank Reconciliation</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Aging Report Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts Payable Aging</CardTitle>
          <CardDescription>Breakdown by payment terms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Current (0-30 days)</span>
                <span className="font-bold">€285,450</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-green-600 h-3 rounded-full" style={{ width: "59%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">1-30 days past due</span>
                <span className="font-bold">€123,960</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-yellow-500 h-3 rounded-full" style={{ width: "26%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">31-60 days past due</span>
                <span className="font-bold">€30,000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-orange-500 h-3 rounded-full" style={{ width: "6%" }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Over 60 days past due</span>
                <span className="font-bold text-red-600">€45,820</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-red-600 h-3 rounded-full" style={{ width: "9%" }}></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>Latest vendor invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
                  <div>
                    <p className="font-medium">INV-2025-{1200 + i}</p>
                    <p className="text-sm text-gray-600">Supplier {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{[2450.50, 3820.75, 1950.30, 4200.90][i-1]}</p>
                    <p className="text-xs text-gray-500">Due: Dec {20 + i}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-gray-100 shadow-lg">
          <CardHeader>
            <CardTitle>Upcoming Payments</CardTitle>
            <CardDescription>Payments due in next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border-2 rounded-2xl hover:border-blue-500 hover:shadow-md transition-all">
                  <div>
                    <p className="font-medium">Payment {i}</p>
                    <p className="text-sm text-gray-600">Vendor {i}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">€{[1850.25, 2650.80, 890.50, 3100.75][i-1]}</p>
                    <p className="text-xs text-orange-600">Due: Dec {22 + i}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
