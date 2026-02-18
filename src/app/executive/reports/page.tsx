"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Calendar, Filter } from "lucide-react";

export default function ConsolidatedReportsPage() {
  const reports = [
    {
      title: "Monthly Financial Report",
      description: "Comprehensive financial overview for December 2025",
      date: "Dec 20, 2025",
      status: "Available",
      type: "Monthly"
    },
    {
      title: "Q4 2025 Quarterly Report",
      description: "Quarter-end financial statements and analysis",
      date: "Dec 31, 2025",
      status: "Generating",
      type: "Quarterly"
    },
    {
      title: "Annual Report 2025",
      description: "Year-end consolidated financial statements",
      date: "Jan 15, 2026",
      status: "Scheduled",
      type: "Annual"
    },
    {
      title: "Multi-Country Comparison",
      description: "ES vs US performance analysis",
      date: "Dec 20, 2025",
      status: "Available",
      type: "Custom"
    },
    {
      title: "Tax Compliance Report",
      description: "VAT and tax summary for all jurisdictions",
      date: "Dec 20, 2025",
      status: "Available",
      type: "Compliance"
    },
    {
      title: "Board of Directors Package",
      description: "Executive summary and key metrics",
      date: "Dec 15, 2025",
      status: "Available",
      type: "Executive"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "badge-light-success";
      case "Generating":
        return "badge-light-info";
      case "Scheduled":
        return "badge-light-warning";
      default:
        return "badge-light-warning";
    }
  };

  return (
    <div className="min-h-full px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <header className="page-header-standard">
          <h1 className="header-title">Consolidated Reports</h1>
          <p className="header-subtitle">
            Access financial reports across all business units
          </p>
        </header>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Total Reports</p>
            <h3 className="text-2xl font-bold mt-2">24</h3>
            <p className="text-sm text-gray-500 mt-1">This year</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Available Now</p>
            <h3 className="text-2xl font-bold mt-2">18</h3>
            <p className="text-sm text-green-600 mt-1">Ready to download</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">In Progress</p>
            <h3 className="text-2xl font-bold mt-2">3</h3>
            <p className="text-sm text-blue-600 mt-1">Generating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Scheduled</p>
            <h3 className="text-2xl font-bold mt-2">3</h3>
            <p className="text-sm text-gray-500 mt-1">Upcoming</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Latest financial reports and documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{report.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-gray-500">{report.date}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
                      <span className="text-xs text-gray-500">{report.type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={getStatusColor(report.status)}>
                    {report.status}
                  </span>
                  {report.status === "Available" && (
                    <Button size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Report Builder</CardTitle>
          <CardDescription>Create custom reports with specific data points</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>P&L Statement</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Balance Sheet</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Cash Flow</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Budget vs Actual</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Variance Analysis</span>
            </Button>
            <Button variant="outline" className="h-24 flex-col gap-2">
              <FileText className="h-6 w-6" />
              <span>Custom Report</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
