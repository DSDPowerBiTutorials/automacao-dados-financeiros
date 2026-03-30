"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Dot,
} from "recharts";
import {
  TrendingUp,
  Loader2,
  RefreshCw,
  Download,
  Info,
  Play,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  LEVEL_COLORS,
  LEVEL_LABELS,
  ALL_LEVELS,
  formatCurrency,
  formatTrendPercent,
  trendToColor,
  ClientLevel,
} from "@/lib/executive-insights/level-utils";
import { TOOLTIPS } from "@/lib/executive-insights/tooltip-content";

interface RevenueTrendsData {
  levels: Record<ClientLevel, {
    monthly: Array<{ month: string; revenue: number }>;
    trend: { slope: number; intercept: number; forecast: Array<{ month: string; revenue: number }> };
    total: number;
    avgMonthly: number;
  }>;
  summary: {
    totalRevenue: number;
    totalMonths: number;
    avgMonthlyPerLevel: Record<ClientLevel, number>;
  };
}

export default function RevenueTrendsPage() {
  const [data, setData] = useState<RevenueTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [faCodeFilter, setFaCodeFilter] = useState("all");
  const [dateStart, setDateStart] = useState(getDateMonthsAgo(12));
  const [dateEnd, setDateEnd] = useState(getTodayISO());
  const [chartData, setChartData] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("faCodeFilter", faCodeFilter);
      params.append("dateRangeStart", dateStart);
      params.append("dateRangeEnd", dateEnd);

      const res = await fetch(
        `/api/executive-insights/revenue-by-level?${params}`,
        { cache: "no-store" }
      );
      const result = await res.json();

      if (result.data) {
        setData(result.data);

        // Prepare chart data (merge monthly data from all levels)
        const monthMap = new Map<string, any>();

        for (const level of ALL_LEVELS) {
          const levelData = result.data.levels[level];
          for (const item of levelData.monthly) {
            const existing = monthMap.get(item.month) || { month: item.month };
            existing[level] = item.revenue;
            monthMap.set(item.month, existing);
          }

          // Add forecast
          for (const forecast of levelData.trend.forecast) {
            const existing = monthMap.get(forecast.month) || { month: forecast.month, isForecast: true };
            existing[`${level}_forecast`] = forecast.revenue;
            monthMap.set(forecast.month, existing);
          }
        }

        const sorted = Array.from(monthMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month)
        );
        setChartData(sorted);
      }
    } catch (error) {
      console.error("Error loading revenue trends:", error);
      toast({
        title: "Error",
        description: "Failed to load revenue trends data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData();
  };

  const calculateGrowth = (level: ClientLevel) => {
    if (!data) return 0;
    const monthlyData = data.levels[level].monthly;
    if (monthlyData.length < 2) return 0;

    const lastMonth = monthlyData[monthlyData.length - 1].revenue;
    const prevMonth = monthlyData[monthlyData.length - 2].revenue;

    if (prevMonth === 0) return 0;
    return ((lastMonth - prevMonth) / prevMonth) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          <div>
            <PageHeader title="Revenue Trends by Level" subtitle="All products" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("#", "_blank")}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            Watch Video
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const tip = TOOLTIPS.revenueTrendsHeader;
              toast({
                title: "Revenue Trends",
                description: tip,
              });
            }}
            className="gap-2"
          >
            <Info className="h-4 w-4" />
            How It Works
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">FA Code Filter</label>
              <Select value={faCodeFilter} onValueChange={setFaCodeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All FA codes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All FA Codes</SelectItem>
                  <SelectItem value="104.1,104.3">Lvl3 ROW (104.1, 104.3)</SelectItem>
                  <SelectItem value="104.2,104.4">Lvl3 AMEX (104.2, 104.4)</SelectItem>
                  <SelectItem value="104.5">Level 2 (104.5)</SelectItem>
                  <SelectItem value="104.6">Level 1 (104.6)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={handleRefresh}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && !data ? (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {ALL_LEVELS.map((level) => {
              const levelData = data.levels[level];
              const growth = calculateGrowth(level);
              const growthColor = trendToColor(growth);

              return (
                <Card key={level}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {LEVEL_LABELS[level]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold">
                      {formatCurrency(levelData.total)}
                    </div>
                    <div className={`text-sm font-semibold ${growthColor}`}>
                      {formatTrendPercent(growth)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue & Forecast</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Solid lines = historical | Dashed lines = 3-month forecast
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis
                      tickFormatter={(value) =>
                        `€${(value / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(value as number)}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />

                    {/* Historical lines */}
                    {ALL_LEVELS.map((level) => (
                      <Line
                        key={`${level}-historic`}
                        type="monotone"
                        dataKey={level}
                        stroke={LEVEL_COLORS[level]}
                        name={LEVEL_LABELS[level]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}

                    {/* Forecast lines (dashed) */}
                    {ALL_LEVELS.map((level) => (
                      <Line
                        key={`${level}-forecast`}
                        type="monotone"
                        dataKey={`${level}_forecast`}
                        stroke={LEVEL_COLORS[level]}
                        name={`${LEVEL_LABELS[level]} (Forecast)`}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Total Revenue by Level</h4>
                  <div className="space-y-2">
                    {ALL_LEVELS.map((level) => (
                      <div
                        key={level}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {LEVEL_LABELS[level]}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(data.levels[level].total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Average Monthly Revenue</h4>
                  <div className="space-y-2">
                    {ALL_LEVELS.map((level) => (
                      <div
                        key={level}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {LEVEL_LABELS[level]}
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(
                            data.summary.avgMonthlyPerLevel[level]
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No data available</p>
        </div>
      )}
    </div>
  );
}

function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split("T")[0];
}

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}
