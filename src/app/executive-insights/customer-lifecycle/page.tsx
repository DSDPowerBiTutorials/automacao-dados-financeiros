"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Flame,
    Thermometer,
    Snowflake,
    Loader2,
    RefreshCw,
    Users,
    Package,
    TrendingUp,
    Download,
    Calendar,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatters";

interface CustomerData {
    customerId: string;
    customerName: string;
    customerEmail: string;
    totalQuantity: number;
    orderCount: number;
    lastPurchaseDate: string;
    firstPurchaseDate: string;
    averageQtyPerOrder: number;
    daysSinceLastPurchase: number;
    segment: "HOT" | "WARM" | "COLD";
}

interface Stats {
    totalCustomers: number;
    bySegment: Record<string, number>;
    totalQuantitySold: number;
    averageQtyPerCustomer: number;
}

const SEGMENT_CONFIG = {
    HOT: {
        label: "Hot (Active)",
        color: "bg-red-100 text-red-800 border-red-300",
        icon: Flame,
        description: "Recently active, frequent purchases",
    },
    WARM: {
        label: "Warm (Engaged)",
        color: "bg-yellow-100 text-yellow-800 border-yellow-300",
        icon: Thermometer,
        description: "Moderate activity",
    },
    COLD: {
        label: "Cold (Inactive)",
        color: "bg-blue-100 text-blue-800 border-blue-300",
        icon: Snowflake,
        description: "Low or no recent activity",
    },
};

const DAY_INTERVALS = [10, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360, 365];

export default function CustomerLifecyclePage() {
    const [customers, setCustomers] = useState<CustomerData[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [segment, setSegment] = useState("all");
    const [sortBy, setSortBy] = useState("lastPurchase");
    const [maxDays, setMaxDays] = useState(365);
    const [hotThreshold, setHotThreshold] = useState(90);
    const [warmThreshold, setWarmThreshold] = useState(180);
    const [mostRecentOrderDate, setMostRecentOrderDate] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (segment !== "all") params.append("segment", segment);
            params.append("sortBy", sortBy);
            params.append("limit", "500");
            params.append("maxDays", String(maxDays));
            params.append("hotThreshold", String(hotThreshold));
            params.append("warmThreshold", String(warmThreshold));

            const res = await fetch(
                `/api/executive-insights/customer-lifecycle?${params}`,
                { cache: "no-store" }
            );
            const data = await res.json();

            if (data.success) {
                setCustomers(data.customers);
                setStats(data.stats);
                if (data.mostRecentOrderDate) {
                    setMostRecentOrderDate(data.mostRecentOrderDate);
                }
            } else {
                toast({
                    title: "Error loading data",
                    description: data.error,
                    variant: "destructive",
                });
            }
        } catch (error) {
            console.error("Error:", error);
            toast({
                title: "Error loading customers",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [segment, sortBy, maxDays, hotThreshold, warmThreshold]);

    const getSegmentStats = () => {
        if (!stats) return [];
        return [
            {
                segment: "HOT",
                count: stats.bySegment.HOT,
                percentage: Math.round((stats.bySegment.HOT / stats.totalCustomers) * 100),
            },
            {
                segment: "WARM",
                count: stats.bySegment.WARM,
                percentage: Math.round((stats.bySegment.WARM / stats.totalCustomers) * 100),
            },
            {
                segment: "COLD",
                count: stats.bySegment.COLD,
                percentage: Math.round((stats.bySegment.COLD / stats.totalCustomers) * 100),
            },
        ];
    };

    const segmentStats = getSegmentStats();

    const renderSegmentBadge = (seg: "HOT" | "WARM" | "COLD") => {
        const config = SEGMENT_CONFIG[seg];
        const Icon = config.icon;
        return (
            <div className="flex items-center gap-2">
                <Icon size={14} />
                <Badge className={`${config.color} border`}>{config.label}</Badge>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <PageHeader
                    title="NR Thermometer"
                    subtitle="Natural Restoration Product Engagement Segmentation (based on purchase quantity)"
                />

                {/* Most Recent Order Date + Day Filter */}
                <Card className="border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                    <CardContent className="pt-6 pb-4 space-y-4">
                        {mostRecentOrderDate && (
                            <div className="flex items-center gap-2 text-sm">
                                <Calendar size={16} className="text-gray-500" />
                                <span className="text-gray-600 dark:text-gray-400">Most Recent Order Date:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatDate(mostRecentOrderDate)}
                                </span>
                                <span className="text-xs text-gray-400 ml-1">(inactive days count from this date)</span>
                            </div>
                        )}
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                Max Inactive Days: <span className="font-bold text-gray-900 dark:text-white">{maxDays}</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">10</span>
                                <input
                                    type="range"
                                    min={10}
                                    max={365}
                                    step={5}
                                    value={maxDays}
                                    onChange={(e) => setMaxDays(parseInt(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:bg-gray-700"
                                />
                                <span className="text-xs text-gray-500">365</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                {[10, 30, 90, 180, 365].map((d) => (
                                    <button
                                        key={d}
                                        onClick={() => setMaxDays(d)}
                                        className={`text-xs px-2 py-0.5 rounded ${maxDays === d ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-semibold" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
                                    >
                                        {d}d
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Segment Threshold Sliders */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Segment Thresholds</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                                        <Flame size={12} /> HOT: ≤ <span className="font-bold">{hotThreshold}d</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">10</span>
                                        <input
                                            type="range"
                                            min={10}
                                            max={365}
                                            step={5}
                                            value={hotThreshold}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value);
                                                setHotThreshold(v);
                                                if (warmThreshold < v) setWarmThreshold(v);
                                            }}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500 dark:bg-gray-700"
                                        />
                                        <span className="text-xs text-gray-500">365</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                                        <Thermometer size={12} /> WARM: {hotThreshold + 1}–<span className="font-bold">{warmThreshold}d</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">{hotThreshold}</span>
                                        <input
                                            type="range"
                                            min={hotThreshold}
                                            max={365}
                                            step={5}
                                            value={warmThreshold}
                                            onChange={(e) => setWarmThreshold(Math.max(hotThreshold, parseInt(e.target.value)))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500 dark:bg-gray-700"
                                        />
                                        <span className="text-xs text-gray-500">365</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                                <span className="flex items-center gap-1"><Flame size={10} className="text-red-500" /> HOT ≤ {hotThreshold}d</span>
                                <span>|</span>
                                <span className="flex items-center gap-1"><Thermometer size={10} className="text-yellow-500" /> WARM {hotThreshold + 1}–{warmThreshold}d</span>
                                <span>|</span>
                                <span className="flex items-center gap-1"><Snowflake size={10} className="text-blue-500" /> COLD &gt; {warmThreshold}d</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Summary Stats */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="border-gray-200 dark:border-gray-800">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <Users size={16} />
                                    Total Customers
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats.totalCustomers}</div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Purchasing Natural Restoration
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-gray-200 dark:border-gray-800">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                    <Package size={16} />
                                    Total Units Sold
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{stats.totalQuantitySold}</div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Avg {stats.averageQtyPerCustomer} per customer
                                </p>
                            </CardContent>
                        </Card>

                        {segmentStats.map((s) => (
                            <Card key={s.segment} className="border-gray-200 dark:border-gray-800">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        {React.createElement(SEGMENT_CONFIG[s.segment as "HOT" | "WARM" | "COLD"].icon, { size: 16 })}
                                        {SEGMENT_CONFIG[s.segment as "HOT" | "WARM" | "COLD"].label}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-3xl font-bold">{s.count}</div>
                                    <p className="text-xs text-gray-500 mt-1">{s.percentage}% of total</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Controls */}
                <div className="flex gap-3 items-end">
                    <div className="flex-1 max-w-xs">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Filter by Segment
                        </label>
                        <Select value={segment} onValueChange={setSegment}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Segments</SelectItem>
                                <SelectItem value="HOT">Hot (Active)</SelectItem>
                                <SelectItem value="WARM">Warm (Engaged)</SelectItem>
                                <SelectItem value="COLD">Cold (Inactive)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex-1 max-w-xs">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                            Sort By
                        </label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="lastPurchase">Last Purchase (Recent)</SelectItem>
                                <SelectItem value="quantity">Total Quantity (High)</SelectItem>
                                <SelectItem value="orderCount">Order Count (Frequent)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        onClick={loadData}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </Button>
                </div>



                {/* Customers Table */}
                <Card className="border-gray-200 dark:border-gray-800">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>
                                Customers
                                {segment !== "all" && ` (${segment})`}
                            </span>
                            <span className="text-sm font-normal text-gray-500">
                                {customers.length} results
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                        ) : customers.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No customers found
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead className="text-right">Total Qty</TableHead>
                                            <TableHead className="text-right">Orders</TableHead>
                                            <TableHead className="text-right">Avg Qty/Order</TableHead>
                                            <TableHead>Last Purchase</TableHead>
                                            <TableHead className="text-right">Days Inactive</TableHead>
                                            <TableHead>Segment</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customers.map((customer) => (
                                            <TableRow key={customer.customerId}>
                                                <TableCell className="font-medium">
                                                    {customer.customerName}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                                    {customer.customerEmail}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {customer.totalQuantity}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {customer.orderCount}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-600 dark:text-gray-400">
                                                    {customer.averageQtyPerOrder}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {formatDate(customer.lastPurchaseDate)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span
                                                        className={`${customer.daysSinceLastPurchase <= hotThreshold
                                                            ? "text-green-600"
                                                            : customer.daysSinceLastPurchase <= warmThreshold
                                                                ? "text-yellow-600"
                                                                : "text-red-600"
                                                            }`}
                                                    >
                                                        {customer.daysSinceLastPurchase}d
                                                    </span>
                                                </TableCell>
                                                <TableCell>{renderSegmentBadge(customer.segment)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer Note */}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p>
                        <strong>Methodology:</strong> Customers are segmented by days inactive
                        (since most recent order date in ar_invoices). HOT = ≤ {hotThreshold} days.
                        WARM = {hotThreshold + 1}–{warmThreshold} days. COLD = &gt; {warmThreshold} days.
                        Adjust thresholds using the sliders above.
                    </p>
                </div>
            </div>
        </div>
    );
}
