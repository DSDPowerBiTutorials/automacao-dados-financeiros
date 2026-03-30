"use client";

// Executive Insights Hub - Deployed Mar 30, 2026
import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    Users,
    TrendingUp,
    Flame,
    ArrowRight,
} from "lucide-react";

interface InsightCard {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
    status: "ready" | "coming-soon";
    tags: string[];
}

const INSIGHTS: InsightCard[] = [
    {
        title: "NR Thermometer",
        description:
            "Natural Restoration product engagement segmentation. Classify customers as HOT (active), WARM (engaged), or COLD (inactive) based on purchase quantity and recency.",
        href: "/executive-insights/customer-lifecycle",
        icon: <Users size={24} className="text-blue-500" />,
        status: "ready",
        tags: ["Natural Restoration", "Customer Segmentation", "Quantity-Based"],
    },
    {
        title: "Revenue Trends by Level",
        description:
            "Analyze revenue trends across all products segmented by client level. Includes historical data and 3-month forward forecast using linear regression.",
        href: "/executive-insights/revenue-trends",
        icon: <TrendingUp size={24} className="text-green-500" />,
        status: "ready",
        tags: ["Revenue", "Forecasting", "Level Analysis"],
    },
    {
        title: "Customer Health by Level",
        description:
            "Real-time customer health KPIs by client level. Track LTV, churn rate, average order value, and repeat rate across all business segments.",
        href: "/executive-insights/customer-health",
        icon: <BarChart3 size={24} className="text-purple-500" />,
        status: "ready",
        tags: ["KPIs", "Churn", "Health Metrics"],
    },
    {
        title: "Market Performance by Level",
        description:
            "Composite scoring system by client level. Combines revenue growth, customer acquisition trends, and concentration risk for strategic insights.",
        href: "/executive-insights/market-performance",
        icon: <Flame size={24} className="text-orange-500" />,
        status: "ready",
        tags: ["Scoring", "Performance", "Strategy"],
    },
];

export default function ExecutiveInsightsPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <PageHeader
                    title="Executive Insights"
                    subtitle="Strategic business intelligence dashboards and customer analytics"
                />

                {/* Grid of Insight Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {INSIGHTS.map((insight) => (
                        <Card
                            key={insight.href}
                            className="border-gray-200 dark:border-gray-800 hover:shadow-md transition-all"
                        >
                            <CardHeader>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        {insight.icon}
                                    </div>
                                    {insight.status === "coming-soon" && (
                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>
                                <CardTitle className="text-lg">{insight.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {insight.description}
                                </p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2">
                                    {insight.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Button */}
                                <Button
                                    asChild
                                    variant={insight.status === "ready" ? "default" : "outline"}
                                    disabled={insight.status === "coming-soon"}
                                    className="w-full"
                                >
                                    <Link href={insight.href}>
                                        {insight.status === "ready" ? (
                                            <>
                                                View Analysis
                                                <ArrowRight size={16} className="ml-2" />
                                            </>
                                        ) : (
                                            "Coming Soon"
                                        )}
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Info Section */}
                <Card className="border-gray-200 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/10">
                    <CardHeader>
                        <CardTitle className="text-base">About Executive Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <p>
                            Executive Insights provides strategic business intelligence through
                            data-driven dashboards and analytics. All analyses focus on actionable
                            metrics for executive decision-making.
                        </p>
                        <p>
                            <strong>Data Sources:</strong> Natural Restoration product orders,
                            invoice data, customer purchase history, and multi-currency financial
                            records.
                        </p>
                        <p>
                            <strong>Update Frequency:</strong> Real-time (based on latest transaction
                            data in the system).
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
