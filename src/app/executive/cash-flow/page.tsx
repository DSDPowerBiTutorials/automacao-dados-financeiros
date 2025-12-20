"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertCircle } from "lucide-react";

export default function CashFlowSummaryPage() {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cash Flow Summary</h1>
        <p className="text-gray-600 mt-1">
          Monitor your cash position and forecast future flows
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cash Inflow</p>
                <h3 className="text-2xl font-bold text-green-600 mt-2">€1,245,680</h3>
                <p className="text-sm text-gray-500 mt-1">This month</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <ArrowDownCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cash Outflow</p>
                <h3 className="text-2xl font-bold text-red-600 mt-2">€987,450</h3>
                <p className="text-sm text-gray-500 mt-1">This month</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <ArrowUpCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Cash Flow</p>
                <h3 className="text-2xl font-bold text-blue-600 mt-2">€258,230</h3>
                <p className="text-sm text-green-600 font-medium mt-1">+26.2% vs last month</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Operating Activities</CardTitle>
            <CardDescription>Cash flow from core business operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Revenue Collections</span>
                <span className="text-sm font-bold text-green-600">+€1,125,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Supplier Payments</span>
                <span className="text-sm font-bold text-red-600">-€645,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Operating Expenses</span>
                <span className="text-sm font-bold text-red-600">-€234,500</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Taxes Paid</span>
                <span className="text-sm font-bold text-red-600">-€89,250</span>
              </div>
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-bold">Net Operating Cash Flow</span>
                <span className="font-bold text-green-600">+€156,250</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Investing & Financing</CardTitle>
            <CardDescription>Capital investments and financing activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Equipment Purchase</span>
                <span className="text-sm font-bold text-red-600">-€45,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Loan Proceeds</span>
                <span className="text-sm font-bold text-green-600">+€150,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Loan Repayment</span>
                <span className="text-sm font-bold text-red-600">-€25,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Dividends Paid</span>
                <span className="text-sm font-bold text-red-600">-€35,000</span>
              </div>
              <div className="border-t pt-4 flex justify-between items-center">
                <span className="font-bold">Net Other Cash Flow</span>
                <span className="font-bold text-green-600">+€45,000</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Position Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Position Forecast</CardTitle>
          <CardDescription>Projected cash balance for the next 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">Current Cash Balance</p>
                <p className="text-lg font-bold text-blue-900">€823,450</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Period</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Inflow</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Outflow</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Net</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">Next 30 days</td>
                    <td className="py-3 px-4 text-right text-green-600">+€450,000</td>
                    <td className="py-3 px-4 text-right text-red-600">-€380,000</td>
                    <td className="py-3 px-4 text-right font-medium">+€70,000</td>
                    <td className="py-3 px-4 text-right font-bold">€893,450</td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">30-60 days</td>
                    <td className="py-3 px-4 text-right text-green-600">+€520,000</td>
                    <td className="py-3 px-4 text-right text-red-600">-€410,000</td>
                    <td className="py-3 px-4 text-right font-medium">+€110,000</td>
                    <td className="py-3 px-4 text-right font-bold">€1,003,450</td>
                  </tr>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">60-90 days</td>
                    <td className="py-3 px-4 text-right text-green-600">+€480,000</td>
                    <td className="py-3 px-4 text-right text-red-600">-€395,000</td>
                    <td className="py-3 px-4 text-right font-medium">+€85,000</td>
                    <td className="py-3 px-4 text-right font-bold">€1,088,450</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
