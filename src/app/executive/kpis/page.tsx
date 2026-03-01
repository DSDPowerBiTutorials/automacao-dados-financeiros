"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default function KPIsPage() {
  const kpis = [
    {
      category: "Profitability",
      metrics: [
        { name: "Gross Profit Margin", value: "45.2%", target: "40%", status: "good", change: "+2.1%" },
        { name: "Operating Profit Margin", value: "24.8%", target: "25%", status: "warning", change: "-0.5%" },
        { name: "Net Profit Margin", value: "18.5%", target: "15%", status: "good", change: "+1.3%" },
        { name: "Return on Assets (ROA)", value: "12.4%", target: "10%", status: "good", change: "+0.8%" }
      ]
    },
    {
      category: "Liquidity",
      metrics: [
        { name: "Current Ratio", value: "2.45", target: "2.0", status: "good", change: "+0.15" },
        { name: "Quick Ratio", value: "1.85", target: "1.5", status: "good", change: "+0.10" },
        { name: "Cash Ratio", value: "0.95", target: "0.8", status: "good", change: "+0.05" },
        { name: "Working Capital", value: "€485,000", target: "€400,000", status: "good", change: "+€45,000" }
      ]
    },
    {
      category: "Efficiency",
      metrics: [
        { name: "Asset Turnover", value: "1.45", target: "1.3", status: "good", change: "+0.08" },
        { name: "Inventory Turnover", value: "8.2", target: "8.0", status: "good", change: "+0.3" },
        { name: "Days Sales Outstanding", value: "32 days", target: "35 days", status: "good", change: "-2 days" },
        { name: "Days Payable Outstanding", value: "45 days", target: "40 days", status: "warning", change: "+3 days" }
      ]
    },
    {
      category: "Leverage",
      metrics: [
        { name: "Debt-to-Equity", value: "0.65", target: "0.8", status: "good", change: "-0.05" },
        { name: "Debt-to-Assets", value: "0.35", target: "0.4", status: "good", change: "-0.02" },
        { name: "Interest Coverage", value: "8.5x", target: "6.0x", status: "good", change: "+0.5x" },
        { name: "Equity Ratio", value: "62%", target: "55%", status: "good", change: "+2%" }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "text-green-600 bg-green-50";
      case "warning":
        return "text-orange-600 bg-orange-50";
      case "critical":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "good":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-full px-6 py-6 space-y-6">
      {/* Header */}
      <PageHeader title="KPIs & Financial Ratios" subtitle="Key performance indicators and financial health metrics" />

      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Score</p>
                <h3 className="text-3xl font-bold text-green-600 mt-2">8.5/10</h3>
                <p className="text-sm text-gray-500 mt-1">Excellent</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Target className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Metrics on Target</p>
              <h3 className="text-3xl font-bold mt-2">14/16</h3>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">87.5%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Needs Attention</p>
              <h3 className="text-3xl font-bold text-orange-600 mt-2">2</h3>
              <p className="text-sm text-gray-500 mt-1">Review required</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Trend</p>
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <h3 className="text-2xl font-bold text-green-600">Improving</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Categories */}
      <div className="space-y-6">
        {kpis.map((category) => (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle>{category.category} Ratios</CardTitle>
              <CardDescription>
                Financial metrics measuring {category.category.toLowerCase()} performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="table-standard">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Metric</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Current</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Target</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Change</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.metrics.map((metric) => (
                      <tr key={metric.name} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{metric.name}</td>
                        <td className="py-3 px-4 text-right font-bold">{metric.value}</td>
                        <td className="py-3 px-4 text-right text-gray-600">{metric.target}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={
                              metric.change.startsWith("+") || metric.change.startsWith("-")
                                ? metric.change.startsWith("+")
                                  ? "amount-positive"
                                  : "amount-negative"
                                : "text-gray-600"
                            }
                          >
                            {metric.change}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {getStatusIcon(metric.status)}
                            <span
                              className={`badge-light-${metric.status === 'good' ? 'success' : metric.status === 'warning' ? 'warning' : 'danger'}`}
                            >
                              {metric.status === "good"
                                ? "On Target"
                                : metric.status === "warning"
                                  ? "Warning"
                                  : "Critical"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
