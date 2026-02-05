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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, Users, UserPlus, UserMinus, RotateCcw } from "lucide-react";
import { ClinicEventDropdown, ClinicEventType } from "./clinic-event-dropdown";
import { formatCurrency } from "@/lib/formatters";

interface ClinicVariation {
    clinic_id: number;
    email: string;
    name: string;
    company_name: string | null;
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
                    throw new Error("Falha ao carregar variações");
                }

                const data = await response.json();

                if (data.success) {
                    setVariations(data.variations.slice(0, maxItems));
                    setSummary(data.summary);
                    setPeriod(data.period);
                } else {
                    throw new Error(data.error || "Erro desconhecido");
                }
            } catch (err) {
                console.error("Error fetching clinic variations:", err);
                setError(err instanceof Error ? err.message : "Erro ao carregar dados");
            } finally {
                setLoading(false);
            }
        }

        fetchVariations();
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
        return <Minus className="h-4 w-4 text-gray-400" />;
    };

    const formatChange = (change: number, percent: number) => {
        const sign = change >= 0 ? "+" : "";
        const changeStr = formatCurrency(Math.abs(change), "EUR");
        const percentStr = percent.toFixed(1);

        return (
            <span className={change >= 0 ? "text-green-600" : "text-red-600"}>
                {sign}{change >= 0 ? changeStr : `-${changeStr}`} ({sign}{percentStr}%)
            </span>
        );
    };

    const defaultTitle = mode === "monthly"
        ? `Alterações do Mês (${yearMonth})`
        : `Alterações YTD (Jan - ${yearMonth})`;

    if (loading) {
        return (
            <Card className="mt-4">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">{title || defaultTitle}</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="mt-4 border-red-200 bg-red-50">
                <CardContent className="py-4">
                    <p className="text-sm text-red-600">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (variations.length === 0) {
        return (
            <Card className="mt-4">
                <CardHeader className="py-3">
                    <CardTitle className="text-sm font-medium">{title || defaultTitle}</CardTitle>
                </CardHeader>
                <CardContent className="py-4">
                    <p className="text-sm text-gray-500">Nenhuma variação encontrada para este período.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="mt-4">
            <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-medium">{title || defaultTitle}</CardTitle>
                        <CardDescription className="text-xs">{period}</CardDescription>
                    </div>
                    {summary && (
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span>{summary.total_clinics}</span>
                            </div>
                            {summary.new_clinics > 0 && (
                                <div className="flex items-center gap-1 text-green-600">
                                    <UserPlus className="h-4 w-4" />
                                    <span>+{summary.new_clinics}</span>
                                </div>
                            )}
                            {summary.churned_clinics > 0 && (
                                <div className="flex items-center gap-1 text-red-600">
                                    <UserMinus className="h-4 w-4" />
                                    <span>-{summary.churned_clinics}</span>
                                </div>
                            )}
                            {summary.returned_clinics > 0 && (
                                <div className="flex items-center gap-1 text-blue-600">
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
                        <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                                <TableHead className="text-xs w-[180px]">Clinic</TableHead>
                                <TableHead className="text-xs w-[80px]">Region</TableHead>
                                <TableHead className="text-xs w-[80px]">Level</TableHead>
                                <TableHead className="text-xs text-right w-[100px]">Anterior</TableHead>
                                <TableHead className="text-xs text-right w-[100px]">Atual</TableHead>
                                <TableHead className="text-xs text-right w-[140px]">Variação</TableHead>
                                <TableHead className="text-xs w-[100px]">Event</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {variations.map((v) => (
                                <TableRow
                                    key={v.clinic_id}
                                    className={
                                        v.is_churned ? "bg-red-50/50" :
                                            v.is_new ? "bg-green-50/50" :
                                                v.event_type === "Pause" ? "bg-yellow-50/50" :
                                                    v.event_type === "Return" ? "bg-blue-50/50" :
                                                        ""
                                    }
                                >
                                    <TableCell className="py-2">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-medium truncate max-w-[160px]" title={v.name}>
                                                {v.name}
                                            </span>
                                            <span className="text-[10px] text-gray-400 truncate max-w-[160px]" title={v.email}>
                                                {v.email}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-2">
                                        {v.region && (
                                            <Badge variant="outline" className="text-[10px]">
                                                {v.region}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-2">
                                        {v.level && (
                                            <span className="text-xs text-gray-600">{v.level}</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs text-gray-500">
                                        {formatCurrency(v.previous_revenue, "EUR")}
                                    </TableCell>
                                    <TableCell className="py-2 text-right text-xs font-medium">
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
                    <div className="border-t bg-gray-50 px-4 py-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                            Total: {summary.total_clinics} clinics
                        </span>
                        <div className="flex items-center gap-4">
                            <span className="text-gray-500">
                                Anterior: {formatCurrency(summary.total_previous_revenue, "EUR")}
                            </span>
                            <span className="font-medium">
                                Atual: {formatCurrency(summary.total_current_revenue, "EUR")}
                            </span>
                            <span className={summary.total_change >= 0 ? "text-green-600" : "text-red-600"}>
                                {summary.total_change >= 0 ? "+" : ""}{formatCurrency(summary.total_change, "EUR")}
                            </span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
