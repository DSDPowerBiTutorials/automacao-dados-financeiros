"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, TrendingUp, Calendar, AlertCircle } from "lucide-react";

export default function ForecastsPage() {
  return (
    <div className="min-h-full px-6 py-6 space-y-6">
      {/* Header */}
      <header className="page-header-standard">
        <h1 className="header-title">Financial Forecasts</h1>
        <p className="header-subtitle">
          AI-powered predictions and scenario planning
        </p>
      </header>

      {/* Forecast Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Q1 2026 Revenue</p>
                <h3 className="text-2xl font-bold mt-2">€3.8M</h3>
                <p className="text-sm text-green-600 font-medium mt-1">+12% growth</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Projected Margin</p>
                <h3 className="text-2xl font-bold mt-2">26.5%</h3>
                <p className="text-sm text-green-600 font-medium mt-1">+1.7% improvement</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <LineChart className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Confidence Level</p>
                <h3 className="text-2xl font-bold mt-2">85%</h3>
                <p className="text-sm text-gray-500 mt-1">High confidence</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Calendar className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
          <CardDescription>12-month revenue projection with confidence intervals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <LineChart className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Chart Visualization Pending</p>
              <p className="text-sm mt-2">
                Connect with forecasting model to display interactive charts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Projections */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Projections</CardTitle>
          <CardDescription>Detailed breakdown by quarter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Quarter</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Expenses</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">EBITDA</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Margin</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Growth</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Q1 2026</td>
                  <td className="py-3 px-4 text-right font-bold">€3,800,000</td>
                  <td className="py-3 px-4 text-right">€2,790,000</td>
                  <td className="py-3 px-4 text-right font-medium">€1,010,000</td>
                  <td className="py-3 px-4 text-right">26.5%</td>
                  <td className="py-3 px-4 text-right amount-positive">+12.0%</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Q2 2026</td>
                  <td className="py-3 px-4 text-right font-bold">€4,100,000</td>
                  <td className="py-3 px-4 text-right">€3,010,000</td>
                  <td className="py-3 px-4 text-right font-medium">€1,090,000</td>
                  <td className="py-3 px-4 text-right">26.6%</td>
                  <td className="py-3 px-4 text-right amount-positive">+15.5%</td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Q3 2026</td>
                  <td className="py-3 px-4 text-right font-bold">€4,350,000</td>
                  <td className="py-3 px-4 text-right">€3,190,000</td>
                  <td className="py-3 px-4 text-right font-medium">€1,160,000</td>
                  <td className="py-3 px-4 text-right">26.7%</td>
                  <td className="py-3 px-4 text-right amount-positive">+18.2%</td>
                </tr>
                <tr className="border-b hover:bg-gray-50 bg-blue-50">
                  <td className="py-3 px-4 font-medium">Q4 2026</td>
                  <td className="py-3 px-4 text-right font-bold">€4,750,000</td>
                  <td className="py-3 px-4 text-right">€3,460,000</td>
                  <td className="py-3 px-4 text-right font-medium">€1,290,000</td>
                  <td className="py-3 px-4 text-right">27.2%</td>
                  <td className="py-3 px-4 text-right amount-positive">+21.5%</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="py-3 px-4">Total 2026</td>
                  <td className="py-3 px-4 text-right">€17,000,000</td>
                  <td className="py-3 px-4 text-right">€12,450,000</td>
                  <td className="py-3 px-4 text-right">€4,550,000</td>
                  <td className="py-3 px-4 text-right">26.8%</td>
                  <td className="py-3 px-4 text-right amount-positive">+16.8%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Assumptions & Risks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Key Assumptions</CardTitle>
            <CardDescription>Factors driving the forecast</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="font-medium">Customer growth rate: 8-10% quarterly</p>
                  <p className="text-sm text-gray-600">Based on current pipeline and market trends</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="font-medium">Average deal size increase: 5%</p>
                  <p className="text-sm text-gray-600">Premium offerings and upselling strategy</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
                <div>
                  <p className="font-medium">Operating expenses: 73-74% of revenue</p>
                  <p className="text-sm text-gray-600">Cost optimization initiatives in place</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Factors</CardTitle>
            <CardDescription>Potential impacts on forecast accuracy</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Market volatility</p>
                  <p className="text-sm text-gray-600">Economic conditions may impact customer spending</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Competition intensity</p>
                  <p className="text-sm text-gray-600">New entrants could pressure margins</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Currency fluctuations</p>
                  <p className="text-sm text-gray-600">USD/EUR exchange rate impacts international revenue</p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
