"use client";

import * as React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Users, UserPlus, UserMinus, RotateCcw } from "lucide-react";
import { ClinicEventDropdown, ClinicEventType } from "./clinic-event-dropdown";
import { formatCurrency } from "@/lib/formatters";

interface ClinicVariation {
    clinic_id: number;
    customer_name: string;
    region: string | null;
    level: string | null;
    previous_revenue: number;
    current_revenue: number;
    change: number;
    change_percent: number;
    event_type: ClinicEventType;
    event_confirmed: boolean;
    is_new: boolean;
    is_churned: boolean;
}

interface VariationsSummary {
    total_clinics: number;
    new_clinics: number;
    churned_clinics: number;
    paused_clinics: number;
    returned_clinics: number;
    total_current_revenue: number;
    total_previous_revenue: number;
    total_change: number;
}

interface ClinicVariationsTableProps {
    mode: "monthly" | "ytd";
    yearMonth: string; // Format: YYYY-MM
    faCode?: string;
    title?: string;
    maxItems?: number;
}

export function ClinicVariationsTable({
    mode,
    yearMonth,
    faCode,
    title,
    maxItems = 50,
}: ClinicVariationsTableProps) {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [variations, setVariations] = React.useState<ClinicVariation[]>([]);
    const [summary, setSummary] = React.useState<VariationsSummary | null>(null);
    const [period, setPeriod] = React.useState<string>("");

    React.useEffect(() => {
        async function fetchVariations() {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams();
                if (mode === "ytd") {
                    params.set("ytd", yearMonth);
                } else {
                    params.set("month", yearMonth);
                }
                if (faCode) {
                    params.set("fa", faCode);
                }

                const response = await fetch(`/api/clinics/variations?${params.toString()}`);

                if (!response.ok) {
                    throw new Error("Failed to load variations");
                }

                const data = await response.json();

                if (data.success) {
                    setVariations(data.variations.slice(0, maxItems));
                    setSummary(data.summary);
                    setPeriod(data.period);
                } else {
                    throw new Error(data.error || "Unknown error");
                }
            } catch (err) {
                console.error("Error fetching clinic variations:", err);
                setError(err instanceof Error ? err.message : "Failed to load data");
            } finally {
                setLoading(false);
            }
        }

        if (faCode) {
            fetchVariations();
        }
    }, [mode, yearMonth, faCode, maxItems]);

    const handleEventChange = (clinicId: number, newEvent: ClinicEventType) => {
        setVariations(prev =>
            prev.map(v =>
                v.clinic_id === clinicId
                    ? { ...v, event_type: newEvent, event_confirmed: true }
                    : v
            )
        );
    };

    const getChangeIcon = (change: number) => {
        if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
        if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
        return <Minus className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
    };

    const formatChange = (change: number, percent: number) => {
        const sign = change >= 0 ? "+" : "";
        const changeStr = formatCurrency(Math.abs(change), "EUR");
        const percentStr = percent.toFixed(1);

        return (
            <span className={change >= 0 ? "text-green-500" : "text-red-500"}>
                {sign}{change >= 0 ? changeStr : `-${changeStr}`} ({sign}{percentStr}%)
            </span>
        );
    };

    const defaultTitle = mode === "monthly"
        ? `Monthly Changes (${yearMonth})`
        : `YTD Changes (Jan - ${yearMonth})`;

    if (!faCode) {
        return null;
    }

    if (loading) {
        return (
            <Card className="mt-4 bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-gray-700">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200">{title || defaultTitle}</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="mt-4 border-red-700 bg-red-900/20">
                <CardContent className="py-4">
                    <p className="text-sm text-red-400">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (variations.length === 0) {
        return (
            <Card className="mt-4 bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-gray-700">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200">{title || defaultTitle}</CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No changes found for this period.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-4 bg-gray-100 dark:bg-black/50 border-gray-200 dark:border-gray-700">
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-200">{title || defaultTitle}</CardTitle>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{period}</p>
                    </div>
                    {summary && (
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                <Users className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                <span>{summary.total_clinics}</span>
                            </div>
                            {summary.new_clinics > 0 && (
                                <div className="flex items-center gap-1 text-green-500">
                                    <UserPlus className="h-4 w-4" />
                                    <span>+{summary.new_clinics}</span>
                                </div>
                            )}
                            {summary.churned_clinics > 0 && (
                                <div className="flex items-center gap-1 text-red-500">
                                    <UserMinus className="h-4 w-4" />
                                    <span>-{summary.churned_clinics}</span>
                                </div>
                            )}
                            {summary.returned_clinics > 0 && (
                                <div className="flex items-center gap-1 text-blue-500">
                                    <RotateCcw className="h-4 w-4" />
                                    <span>{summary.returned_clinics}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="px-0 py-0">
                <div className="max-h-80 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-gray-100 dark:bg-black z-10">
                            <TableRow className="border-gray-200 dark:border-gray-700">
                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-[200px]">Clinic</TableHead>
                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-[80px]">Level</TableHead>
                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right w-[120px]">Monthly Revenue</TableHead>
                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 text-right w-[140px]">Change</TableHead>
                                <TableHead className="text-xs text-gray-700 dark:text-gray-300 w-[100px]">Event</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variations.map((v, idx) => (
                                <TableRow
                                    key={v.clinic_id || idx}
                                    className={`border-gray-200 dark:border-gray-700 ${v.is_churned ? "bg-red-900/20" :
                                            v.is_new ? "bg-green-900/20" :
                                                v.event_type === "Pause" ? "bg-yellow-900/20" :
                                                    v.event_type === "Return" ? "bg-blue-900/20" :
                                                        ""
                                        }`}
                                >
                                    <TableCell className="py-2">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-200 truncate max-w-[180px] block" title={v.customer_name}>
                                            {v.customer_name}
                                        </span>
                                    </TableCell>
                                    <TableCell className="py-2">
                                        {v.level && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{v.level}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-200">
                                        {formatCurrency(v.current_revenue, "EUR")}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs">
                                        <div className="flex items-center justify-end gap-1">
                                            {getChangeIcon(v.change)}
                                            {formatChange(v.change, v.change_percent)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                        <ClinicEventDropdown
                                            clinicId={v.clinic_id}
                                            currentEvent={v.event_type}
                                            isNew={v.is_new}
                                            isChurned={v.is_churned && v.event_type !== "Churn"}
                                            yearMonth={yearMonth}
                                            onEventChange={(newEvent) => handleEventChange(v.clinic_id, newEvent)}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Summary footer */}
                {summary && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-black px-4 py-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">
                            Total: {summary.total_clinics} clinics
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500 dark:text-gray-400">
                                Previous: {formatCurrency(summary.total_previous_revenue, "EUR")}
                            </span>
                            <span className="font-medium text-gray-600 dark:text-gray-200">
                                Current: {formatCurrency(summary.total_current_revenue, "EUR")}
                            </span>
                            <span className={summary.total_change >= 0 ? "text-green-500" : "text-red-500"}>
                                {summary.total_change >= 0 ? "+" : ""}{formatCurrency(summary.total_change, "EUR")}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
