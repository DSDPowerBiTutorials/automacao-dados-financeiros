"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface PayrollDataInput {
    period: string;
}

interface GenerateResponse {
    success: boolean;
    inserted_count?: number;
    skipped_idempotency_count?: number;
    overwritten_count?: number;
    provider_code?: string;
    error?: string;
}

function parsePeriod(period: string, fallbackYear: number) {
    const mmYyyy = period?.match(/^(\d{2})\/(\d{4})$/);
    if (mmYyyy) {
        return { month: parseInt(mmYyyy[1], 10), year: parseInt(mmYyyy[2], 10) };
    }
    return { month: new Date().getMonth() + 1, year: fallbackYear };
}

export function PayrollInvoiceGenerator({
    payrollData,
    selectedYear,
}: {
    payrollData: PayrollDataInput | null;
    selectedYear: number;
}) {
    const [generateLoading, setGenerateLoading] = useState(false);
    const [resultMessage, setResultMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const parsedPeriod = useMemo(
        () => parsePeriod(payrollData?.period || "", selectedYear),
        [payrollData?.period, selectedYear],
    );

    const [targetYear, setTargetYear] = useState<number>(selectedYear);
    const [targetMonth, setTargetMonth] = useState<number>(parsedPeriod.month);
    const [mode, setMode] = useState<"create" | "overwrite">("create");

    useEffect(() => {
        setTargetYear(selectedYear);
    }, [selectedYear]);

    useEffect(() => {
        setTargetMonth(parsedPeriod.month);
    }, [parsedPeriod.month, selectedYear]);

    const handleGenerate = async () => {
        setGenerateLoading(true);
        setErrorMessage(null);
        setResultMessage(null);
        try {
            const response = await fetch("/api/payroll/generate-invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    year: targetYear,
                    month: targetMonth,
                    scope: "ES",
                    currency: "EUR",
                    provider_name: "Digital Smile Design Payroll",
                    overwrite_existing: mode === "overwrite",
                    dry_run: false,
                }),
            });
            const json = (await response.json()) as GenerateResponse;
            if (!json.success) {
                setErrorMessage(json.error || "Falha na geração");
                return;
            }

            const modeLabel = mode === "overwrite" ? "sobrescrita" : "criação";
            setResultMessage(
                `Modo ${modeLabel}: geradas ${json.inserted_count || 0} · ignoradas ${json.skipped_idempotency_count || 0} · removidas ${json.overwritten_count || 0}.`,
            );
        } catch (err: any) {
            setErrorMessage(err?.message || "Falha na geração");
        } finally {
            setGenerateLoading(false);
        }
    };

    return (
        <Card className="m-6 mb-3 border-violet-300/50 dark:border-violet-700/50 bg-violet-50/50 dark:bg-violet-950/10">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Payroll → AP Invoices (Grouped)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-300 dark:border-violet-700">
                        Provider: Digital Smile Design Payroll
                    </Badge>
                    <Badge variant="outline" className="border-violet-300 text-violet-700 dark:text-violet-300 dark:border-violet-700">
                        Grouping: FA + Department + Sub-department
                    </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Select value={String(targetYear)} onValueChange={(value) => setTargetYear(parseInt(value, 10))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {[2024, 2025, 2026, 2027].map((year) => (
                                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={String(targetMonth)} onValueChange={(value) => setTargetMonth(parseInt(value, 10))}>
                        <SelectTrigger>
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {[
                                [1, "Jan"], [2, "Feb"], [3, "Mar"], [4, "Apr"],
                                [5, "May"], [6, "Jun"], [7, "Jul"], [8, "Aug"],
                                [9, "Sep"], [10, "Oct"], [11, "Nov"], [12, "Dec"],
                            ].map(([month, label]) => (
                                <SelectItem key={month} value={String(month)}>
                                    {String(month).padStart(2, "0")} - {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={mode} onValueChange={(value) => setMode(value as "create" | "overwrite")}>
                        <SelectTrigger>
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="create">Create (idempotent)</SelectItem>
                            <SelectItem value="overwrite">Overwrite existing</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="md:col-span-1 flex items-center justify-end">
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white w-full" onClick={handleGenerate} disabled={generateLoading}>
                            {generateLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                            Create Invoices
                        </Button>
                    </div>
                </div>

                {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
                {resultMessage && <p className="text-sm text-emerald-500">{resultMessage}</p>}
            </CardContent>
        </Card>
    );
}
