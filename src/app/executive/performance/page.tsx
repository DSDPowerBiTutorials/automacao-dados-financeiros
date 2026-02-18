"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown, DollarSign, Users, Target } from "lucide-react";

export default function PerformanceAnalyticsPage() {
  const metrics = [
    {
      title: "Revenue Growth",
      value: "+12.5%",
      change: "+2.3%",
      trend: "up",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Operating Margin",
      value: "24.8%",
      change: "-0.5%",
      trend: "down",
      icon: Target,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Customer Acquisition",
      value: "1,247",
      change: "+18.2%",
      trend: "up",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Average Deal Size",
      value: "$12,450",
      change: "+5.7%",
      trend: "up",
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  return (
    <div className="min-h-full px-6 py-6 space-y-6">
      {/* Header */}
      <header className="page-header-standard">
        <h1 className="header-title">Performance Analytics</h1>
        <p className="header-subtitle">
          Real-time performance metrics and business intelligence
        </p>
      </header>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown;
          
          return (
            <Card key={metric.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                    <h3 className="text-2xl font-bold mt-2">{metric.value}</h3>
                    <div className="flex items-center gap-1 mt-2">
                      <TrendIcon className={`h-4 w-4 ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`} />
                      <span className={`text-sm font-medium ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                        {metric.change}
                      </span>
                      <span className="text-sm text-gray-500">vs last month</span>
                    </div>
                  </div>
                  <div className={`${metric.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${metric.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Performance</CardTitle>
            <CardDescription>Monthly revenue trend (last 12 months)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Chart integration pending</p>
                <p className="text-sm mt-1">Connect with your analytics platform</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance by Region</CardTitle>
            <CardDescription>Revenue distribution across markets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Spain (ES)</span>
                  <span className="text-gray-600">65%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: "65%" }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">United States (US)</span>
                  <span className="text-gray-600">35%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: "35%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Department Performance</CardTitle>
          <CardDescription>Comparative performance across business units</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="table-standard">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Department</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Growth</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Margin</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Sales</td>
                  <td className="py-3 px-4 text-right">€2,450,000</td>
                  <td className="py-3 px-4 text-right amount-positive">+15.3%</td>
                  <td className="py-3 px-4 text-right">28.5%</td>
                  <td className="py-3 px-4 text-right">
                    <span className="badge-light-success">
                      Excellent
                    </span>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Marketing</td>
                  <td className="py-3 px-4 text-right">€1,250,000</td>
                  <td className="py-3 px-4 text-right amount-positive">+8.7%</td>
                  <td className="py-3 px-4 text-right">22.1%</td>
                  <td className="py-3 px-4 text-right">
                    <span className="badge-light-info">
                      Good
                    </span>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">Operations</td>
                  <td className="py-3 px-4 text-right">€890,000</td>
                  <td className="py-3 px-4 text-right amount-negative">-2.3%</td>
                  <td className="py-3 px-4 text-right">18.9%</td>
                  <td className="py-3 px-4 text-right">
                    <span className="badge-light-warning">
                      Needs Attention
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
