"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Search,
    Upload,
    Download,
    Users,
    DollarSign,
    Calendar,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ChevronRight,
    Building2,
    FileSpreadsheet,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Briefcase,
    Euro,
    Shield,
    Percent,
    X,
} from "lucide-react";

// ════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════

interface PayrollConcept {
    code: number;
    description: string;
    amount: number;
    isDeduction: boolean;
}

interface PayrollEmployee {
    employeeId: string;
    lastName1: string;
    lastName2: string;
    firstName: string;
    fullName: string;
    department: string;
    departmentCode: string;
    concepts: PayrollConcept[];
    totalBruto: number;
    totalDeducciones: number;
    totalLiquido: number;
    ssEmpresa: number;
    ssTrabajador: number;
    costeEmpresa: number;
    irpf: number;
    irpfPercent: number;
    diasCotizados: number;
}

interface DepartmentSummary {
    name: string;
    code: string;
    employeeCount: number;
    totalBruto: number;
    totalDeducciones: number;
    totalLiquido: number;
    ssEmpresa: number;
    costeEmpresa: number;
    concepts: PayrollConcept[];
}

interface PayrollData {
    period: string;
    company: string;
    nif: string;
    currency: string;
    departments: DepartmentSummary[];
    employees: PayrollEmployee[];
    totals: {
        totalBruto: number;
        totalDeducciones: number;
        totalLiquido: number;
        ssEmpresa: number;
        ssTrabajador: number;
        ssTotal: number;
        costeEmpresa: number;
        employeeCount: number;
        irpfTotal: number;
    };
}

type ViewMode = "employees" | "departments" | "monthly";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ════════════════════════════════════════════════════════
// Formatters
// ════════════════════════════════════════════════════════

function fmtEur(value: number): string {
    return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function fmtCompact(value: number): string {
    if (Math.abs(value) >= 1_000_000)
        return `${(value / 1_000_000).toFixed(1)}M €`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K €`;
    return fmtEur(value);
}

function fmtPct(value: number): string {
    return `${value.toFixed(2)}%`;
}

// ════════════════════════════════════════════════════════
// Department color mapping
// ════════════════════════════════════════════════════════

const DEPT_COLORS: Record<
    string,
    { bg: string; text: string; border: string; dot: string }
> = {
    EDUCATION: {
        bg: "bg-blue-900/20",
        text: "text-blue-400",
        border: "border-blue-700/50",
        dot: "bg-blue-400",
    },
    MARKETING: {
        bg: "bg-purple-900/20",
        text: "text-purple-400",
        border: "border-purple-700/50",
        dot: "bg-purple-400",
    },
    "PLANNING CENTER": {
        bg: "bg-emerald-900/20",
        text: "text-emerald-400",
        border: "border-emerald-700/50",
        dot: "bg-emerald-400",
    },
    "CORPORATE FUNCTIONS": {
        bg: "bg-amber-900/20",
        text: "text-amber-400",
        border: "border-amber-700/50",
        dot: "bg-amber-400",
    },
    "DELIGHT ROW": {
        bg: "bg-rose-900/20",
        text: "text-rose-400",
        border: "border-rose-700/50",
        dot: "bg-rose-400",
    },
    LAB: {
        bg: "bg-cyan-900/20",
        text: "text-cyan-400",
        border: "border-cyan-700/50",
        dot: "bg-cyan-400",
    },
};

function getDeptColor(dept: string) {
    return (
        DEPT_COLORS[dept.toUpperCase()] || {
            bg: "bg-gray-900/20",
            text: "text-gray-400",
            border: "border-gray-700/50",
            dot: "bg-gray-400",
        }
    );
}

// ════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════

export default function PayrollPage() {
    const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [viewMode, setViewMode] = useState<ViewMode>("employees");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [monthlyData, setMonthlyData] = useState<Record<string, PayrollData>>({});
    const [initialLoading, setInitialLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Auto-load persisted data on mount ───
    useEffect(() => {
        async function loadPersistedData() {
            try {
                const res = await fetch(`/api/payroll/data?year=${selectedYear}`);
                const json = await res.json();
                if (json.success && json.count > 0) {
                    setMonthlyData(json.monthlyData || {});
                    if (json.currentData) {
                        setPayrollData(json.currentData);
                        setFileName(json.currentFileName || null);
                    }
                }
            } catch (err) {
                console.error("Failed to load payroll data:", err);
            } finally {
                setInitialLoading(false);
            }
        }
        setInitialLoading(true);
        loadPersistedData();
    }, [selectedYear]);

    // ─── Upload handler ───
    const handleUpload = useCallback(async (file: File) => {
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/payroll/upload", {
                method: "POST",
                body: formData,
            });

            const json = await res.json();

            if (!json.success) {
                throw new Error(json.error || "Upload failed");
            }

            setPayrollData(json.data);
            setFileName(file.name);
            setExpandedRows(new Set());
            setExpandedDepts(new Set());

            // Store in monthly data map using period (e.g. "01/2026" → "2026-01")
            if (json.data?.period) {
                const mmYyyy = json.data.period.match(/^(\d{1,2})\/(\d{2,4})$/);
                if (mmYyyy) {
                    let yr = mmYyyy[2];
                    if (yr.length === 2) yr = `20${yr}`;
                    const key = `${yr}-${mmYyyy[1].padStart(2, "0")}`;
                    setMonthlyData((prev) => ({ ...prev, [key]: json.data }));
                } else {
                    // Fallback: extract from longer format
                    const dateMatch = json.data.period.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
                    if (dateMatch) {
                        let yr = dateMatch[3];
                        if (yr.length === 2) yr = `20${yr}`;
                        const key = `${yr}-${dateMatch[2].padStart(2, "0")}`;
                        setMonthlyData((prev) => ({ ...prev, [key]: json.data }));
                    }
                }
            }
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Erro ao processar arquivo",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
        },
        [handleUpload],
    );

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (
                file &&
                (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))
            ) {
                handleUpload(file);
            }
        },
        [handleUpload],
    );

    // ─── Filtered employees ───
    const filteredEmployees = useMemo(() => {
        if (!payrollData) return [];
        return payrollData.employees.filter((emp) => {
            if (departmentFilter !== "all" && emp.department !== departmentFilter)
                return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return (
                    emp.fullName.toLowerCase().includes(q) ||
                    emp.employeeId.toLowerCase().includes(q) ||
                    emp.department.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [payrollData, searchQuery, departmentFilter]);

    const departments = useMemo(
        () => payrollData?.departments.map((d) => d.name).sort() || [],
        [payrollData],
    );

    const toggleRow = (id: string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleDept = (name: string) => {
        setExpandedDepts((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    // ─── Export CSV ───
    const exportCSV = () => {
        if (!payrollData) return;
        const headers = [
            "Employee ID",
            "Full Name",
            "Department",
            "Gross Salary",
            "Deductions",
            "Net Salary",
            "IRPF",
            "% IRPF",
            "SS Company",
            "SS Employee",
            "Company Cost",
            "Days Contributed",
        ];
        const rows = [headers.join(";")];
        filteredEmployees.forEach((emp) => {
            rows.push(
                [
                    emp.employeeId,
                    `"${emp.fullName}"`,
                    `"${emp.department}"`,
                    emp.totalBruto.toFixed(2),
                    emp.totalDeducciones.toFixed(2),
                    emp.totalLiquido.toFixed(2),
                    emp.irpf.toFixed(2),
                    emp.irpfPercent.toFixed(2),
                    emp.ssEmpresa.toFixed(2),
                    emp.ssTrabajador.toFixed(2),
                    emp.costeEmpresa.toFixed(2),
                    emp.diasCotizados.toString(),
                ].join(";"),
            );
        });
        const blob = new Blob(["\uFEFF" + rows.join("\n")], {
            type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${payrollData.period.replace(/\//g, "-")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ════════════════════════════════════════════════════════
    // RENDER — Initial Loading (checking for persisted data)
    // ════════════════════════════════════════════════════════

    if (initialLoading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white items-center justify-center">
                <Loader2 className="h-10 w-10 text-violet-500 animate-spin mb-4" />
                <p className="text-sm text-gray-500">
                    Loading payroll data...
                </p>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    // RENDER — Empty State (no data loaded)
    // ════════════════════════════════════════════════════════

    if (!payrollData && !loading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {/* Header */}
                <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-black">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-violet-500" />
                                Payroll
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                DSD Planning Center S.L. · Spain HQ
                            </p>
                        </div>
                        <div className="flex items-center bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                            {[2025, 2026].map((yr) => (
                                <button
                                    key={yr}
                                    onClick={() => setSelectedYear(yr)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedYear === yr
                                        ? "bg-violet-600 text-white shadow-sm"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    {yr}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upload area */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="max-w-lg w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 text-center hover:border-violet-500 dark:hover:border-violet-500 transition-colors cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <FileSpreadsheet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Upload payroll file
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Drag the .xlsx file here or click to select
                        </p>
                        <p className="text-xs text-gray-400 mb-6">
                            Expected format: Labour Costs export (Excel) with
                            department breakdown
                        </p>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-sm mb-4 justify-center">
                                <AlertCircle className="h-4 w-4" />
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <Button
                                size="sm"
                                className="bg-violet-600 hover:bg-violet-700 text-white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                }}
                            >
                                <Upload className="h-4 w-4 mr-1" />
                                Select File
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    // RENDER — Loading
    // ════════════════════════════════════════════════════════

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white items-center justify-center">
                <Loader2 className="h-10 w-10 text-violet-500 animate-spin mb-4" />
                <p className="text-sm text-gray-500">
                    Processing payroll file...
                </p>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════
    // RENDER — Data Loaded
    // ════════════════════════════════════════════════════════

    const data = payrollData!;
    const totals = data.totals;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white">
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* ─── Header ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-black">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Users className="h-5 w-5 text-violet-500" />
                            Payroll
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                            <Building2 className="h-3.5 w-3.5" />
                            {data.company} · NIF: {data.nif} ·{" "}
                            <Calendar className="h-3.5 w-3.5" />
                            {data.period}
                            {fileName && (
                                <span className="text-gray-400">
                                    {" "}
                                    ·{" "}
                                    <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-500" />{" "}
                                    {fileName}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* View toggle */}
                        <div className="flex items-center bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                            {(
                                [
                                    ["employees", "Employees"],
                                    ["departments", "Departments"],
                                    ["monthly", "Monthly"],
                                ] as const
                            ).map(([mode, label]) => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === mode
                                        ? "bg-violet-600 text-white shadow-sm"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {/* Year toggle */}
                        <div className="flex items-center bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                            {[2025, 2026].map((yr) => (
                                <button
                                    key={yr}
                                    onClick={() => setSelectedYear(yr)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedYear === yr
                                        ? "bg-violet-600 text-white shadow-sm"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    {yr}
                                </button>
                            ))}
                        </div>
                        {/* Upload another */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
                        >
                            <Upload className="h-4 w-4 mr-1" />
                            Upload Another
                        </Button>
                        {/* Export */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={exportCSV}
                            className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
                        >
                            <Download className="h-4 w-4 mr-1" /> Export
                        </Button>
                        {/* Clear */}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setPayrollData(null);
                                setFileName(null);
                            }}
                            className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Search & filter (employees view only) */}
                {viewMode === "employees" && (
                    <div className="flex items-center gap-3 mt-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Search by name, ID or department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 w-72 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500"
                            />
                        </div>
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white"
                        >
                            <option value="all">All Departments</option>
                            {departments.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-gray-500">
                            {filteredEmployees.length} of {data.employees.length} employees
                        </span>
                    </div>
                )}
            </div>

            {/* ─── KPI Bar ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <KpiCard
                        icon={<Users className="h-4 w-4 text-violet-500" />}
                        label="Employees"
                        value={String(totals.employeeCount)}
                    />
                    <KpiCard
                        icon={<Euro className="h-4 w-4 text-green-500" />}
                        label="Gross Total"
                        value={fmtCompact(totals.totalBruto)}
                        valueColor="text-green-400"
                    />
                    <KpiCard
                        icon={<TrendingDown className="h-4 w-4 text-red-500" />}
                        label="Deductions"
                        value={fmtCompact(totals.totalDeducciones)}
                        valueColor="text-red-400"
                    />
                    <KpiCard
                        icon={<DollarSign className="h-4 w-4 text-emerald-500" />}
                        label="Net (Liquid)"
                        value={fmtCompact(totals.totalLiquido)}
                        valueColor="text-emerald-400"
                    />
                    <KpiCard
                        icon={<Shield className="h-4 w-4 text-blue-500" />}
                        label="SS Company"
                        value={fmtCompact(totals.ssEmpresa)}
                        valueColor="text-blue-400"
                    />
                    <KpiCard
                        icon={<Percent className="h-4 w-4 text-orange-500" />}
                        label="IRPF Total"
                        value={fmtCompact(totals.irpfTotal)}
                        valueColor="text-orange-400"
                    />
                    <KpiCard
                        icon={<Briefcase className="h-4 w-4 text-amber-500" />}
                        label="Company Cost"
                        value={fmtCompact(totals.costeEmpresa)}
                        valueColor="text-amber-400"
                    />
                </div>
            </div>

            {/* ─── Main Content ─── */}
            <div className="flex-1 overflow-auto">
                {viewMode === "employees" ? (
                    <EmployeesTable
                        employees={filteredEmployees}
                        expandedRows={expandedRows}
                        toggleRow={toggleRow}
                    />
                ) : viewMode === "departments" ? (
                    <DepartmentsView
                        departments={data.departments}
                        employees={data.employees}
                        expandedDepts={expandedDepts}
                        toggleDept={toggleDept}
                    />
                ) : (
                    <MonthlyView
                        monthlyData={monthlyData}
                        selectedYear={selectedYear}
                        employees={data.employees}
                    />
                )}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════
// KPI Card
// ════════════════════════════════════════════════════════

function KpiCard({
    icon,
    label,
    value,
    valueColor = "text-gray-900 dark:text-white",
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-shrink-0">{icon}</div>
            <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                    {label}
                </p>
                <p className={`text-sm font-bold ${valueColor}`}>{value}</p>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════
// Employees Table
// ════════════════════════════════════════════════════════

function EmployeesTable({
    employees,
    expandedRows,
    toggleRow,
}: {
    employees: PayrollEmployee[];
    expandedRows: Set<string>;
    toggleRow: (id: string) => void;
}) {
    const sorted = useMemo(
        () =>
            [...employees].sort((a, b) => {
                const deptCompare = a.department.localeCompare(b.department);
                if (deptCompare !== 0) return deptCompare;
                return a.fullName.localeCompare(b.fullName);
            }),
        [employees],
    );

    const grandBruto = sorted.reduce((s, e) => s + e.totalBruto, 0);
    const grandDeduc = sorted.reduce((s, e) => s + e.totalDeducciones, 0);
    const grandNet = sorted.reduce((s, e) => s + e.totalLiquido, 0);
    const grandCoste = sorted.reduce((s, e) => s + e.costeEmpresa, 0);

    return (
        <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#0a0a0a]">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase font-medium w-8"></th>
                    <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        ID
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        Employee
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        Department
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        Gross
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        Deductions
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        IRPF
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        % IRPF
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium">
                        Net
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs text-gray-500 uppercase font-medium bg-gray-200/50 dark:bg-gray-800/50">
                        Company Cost
                    </th>
                </tr>
            </thead>
            <tbody>
                {sorted.map((emp) => {
                    const isExpanded = expandedRows.has(emp.employeeId);
                    const deptColor = getDeptColor(emp.department);

                    return (
                        <React.Fragment key={emp.employeeId}>
                            <tr
                                onClick={() => toggleRow(emp.employeeId)}
                                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0a0a0a] cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2.5">
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                    )}
                                </td>
                                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">
                                    {emp.employeeId}
                                </td>
                                <td className="px-3 py-2.5">
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                                        {emp.fullName}
                                    </p>
                                </td>
                                <td className="px-3 py-2.5">
                                    <Badge
                                        className={`${deptColor.bg} ${deptColor.text} text-xs border ${deptColor.border}`}
                                    >
                                        {emp.department}
                                    </Badge>
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs text-green-600 dark:text-green-400">
                                    {fmtEur(emp.totalBruto)}
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs text-red-600 dark:text-red-400">
                                    {fmtEur(emp.totalDeducciones)}
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs text-orange-600 dark:text-orange-400">
                                    {fmtEur(emp.irpf)}
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs text-orange-500">
                                    {fmtPct(emp.irpfPercent)}
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    {fmtEur(emp.totalLiquido)}
                                </td>
                                <td className="text-right px-3 py-2.5 font-mono text-xs font-medium text-amber-600 dark:text-amber-400 bg-gray-50/50 dark:bg-gray-900/30">
                                    {fmtEur(emp.costeEmpresa)}
                                </td>
                            </tr>

                            {/* Expanded detail row */}
                            {isExpanded && (
                                <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
                                    <td colSpan={10} className="px-6 py-4">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
                                            {/* Earnings */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                                    Earnings (Accruals)
                                                </h4>
                                                <div className="space-y-1">
                                                    {emp.concepts
                                                        .filter((c) => !c.isDeduction)
                                                        .map((c, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex justify-between text-xs"
                                                            >
                                                                <span className="text-gray-600 dark:text-gray-400">
                                                                    <span className="font-mono text-gray-400 mr-2">
                                                                        {String(c.code).padStart(3, "0")}
                                                                    </span>
                                                                    {c.description}
                                                                </span>
                                                                <span
                                                                    className={`font-mono ${c.amount < 0 ? "text-red-400" : "text-green-500"}`}
                                                                >
                                                                    {fmtEur(c.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    <div className="flex justify-between text-xs font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                                        <span className="text-gray-900 dark:text-white">
                                                            TOTAL GROSS
                                                        </span>
                                                        <span className="text-green-500">
                                                            {fmtEur(emp.totalBruto)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Deductions */}
                                            <div>
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                                    Deductions
                                                </h4>
                                                <div className="space-y-1">
                                                    {emp.concepts
                                                        .filter((c) => c.isDeduction)
                                                        .map((c, idx) => (
                                                            <div
                                                                key={idx}
                                                                className="flex justify-between text-xs"
                                                            >
                                                                <span className="text-gray-600 dark:text-gray-400">
                                                                    <span className="font-mono text-gray-400 mr-2">
                                                                        {String(c.code).padStart(3, "0")}
                                                                    </span>
                                                                    {c.description}
                                                                </span>
                                                                <span className="font-mono text-red-400">
                                                                    {fmtEur(c.amount)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    <div className="flex justify-between text-xs font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                                        <span className="text-gray-900 dark:text-white">
                                                            TOTAL DEDUCTIONS
                                                        </span>
                                                        <span className="text-red-400">
                                                            {fmtEur(emp.totalDeducciones)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Summary row */}
                                            <div className="lg:col-span-2 grid grid-cols-4 gap-4 border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
                                                <div>
                                                    <span className="text-[10px] text-gray-500 uppercase block">
                                                        Net (Liquid)
                                                    </span>
                                                    <span className="text-sm font-bold text-emerald-400">
                                                        {fmtEur(emp.totalLiquido)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-500 uppercase block">
                                                        SS Company
                                                    </span>
                                                    <span className="text-sm font-bold text-blue-400">
                                                        {fmtEur(emp.ssEmpresa)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-500 uppercase block">
                                                        SS Employee
                                                    </span>
                                                    <span className="text-sm font-bold text-blue-300">
                                                        {fmtEur(emp.ssTrabajador)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-gray-500 uppercase block">
                                                        Days Contributed
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400">
                                                        {emp.diasCotizados}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}

                {/* Grand total row */}
                <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#0a0a0a] font-medium sticky bottom-0">
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-gray-900 dark:text-white font-semibold">
                        TOTAL ({sorted.length} employees)
                    </td>
                    <td className="px-3 py-3"></td>
                    <td className="text-right px-3 py-3 font-mono text-xs text-green-500 font-bold">
                        {fmtEur(grandBruto)}
                    </td>
                    <td className="text-right px-3 py-3 font-mono text-xs text-red-400 font-bold">
                        {fmtEur(grandDeduc)}
                    </td>
                    <td className="text-right px-3 py-3"></td>
                    <td className="text-right px-3 py-3"></td>
                    <td className="text-right px-3 py-3 font-mono text-xs text-emerald-400 font-bold">
                        {fmtEur(grandNet)}
                    </td>
                    <td className="text-right px-3 py-3 font-mono text-xs text-amber-400 font-bold bg-gray-200/50 dark:bg-gray-800/50">
                        {fmtEur(grandCoste)}
                    </td>
                </tr>
            </tbody>
        </table>
    );
}

// ════════════════════════════════════════════════════════
// Departments View
// ════════════════════════════════════════════════════════

function DepartmentsView({
    departments,
    employees,
    expandedDepts,
    toggleDept,
}: {
    departments: DepartmentSummary[];
    employees: PayrollEmployee[];
    expandedDepts: Set<string>;
    toggleDept: (name: string) => void;
}) {
    return (
        <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {departments.map((dept) => {
                    const deptColor = getDeptColor(dept.name);
                    const isExpanded = expandedDepts.has(dept.name);
                    const deptEmployees = employees
                        .filter((e) => e.department === dept.name)
                        .sort((a, b) => b.totalBruto - a.totalBruto);

                    return (
                        <div
                            key={dept.code}
                            className={`rounded-xl border ${deptColor.border} ${deptColor.bg} overflow-hidden`}
                        >
                            {/* Department header */}
                            <div
                                className="px-5 py-4 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => toggleDept(dept.name)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-2 h-2 rounded-full ${deptColor.dot}`}
                                        />
                                        <h3
                                            className={`font-bold text-sm ${deptColor.text} uppercase`}
                                        >
                                            {dept.code} {dept.name}
                                        </h3>
                                    </div>
                                    <Badge
                                        className={`${deptColor.bg} ${deptColor.text} text-xs border ${deptColor.border}`}
                                    >
                                        {dept.employeeCount} emp.
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">Gross</p>
                                        <p className="text-sm font-bold text-green-400">
                                            {fmtCompact(dept.totalBruto)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">Net</p>
                                        <p className="text-sm font-bold text-emerald-400">
                                            {fmtCompact(dept.totalLiquido)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">
                                            Deductions
                                        </p>
                                        <p className="text-sm font-bold text-red-400">
                                            {fmtCompact(dept.totalDeducciones)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-500 uppercase">
                                            Company Cost
                                        </p>
                                        <p className="text-sm font-bold text-amber-400">
                                            {fmtCompact(dept.costeEmpresa)}
                                        </p>
                                    </div>
                                </div>

                                {/* Progress bar: net vs deductions */}
                                <div className="mt-3 h-2 rounded-full bg-gray-700/30 overflow-hidden flex">
                                    {dept.totalBruto > 0 && (
                                        <>
                                            <div
                                                className="h-full bg-emerald-500"
                                                style={{
                                                    width: `${(dept.totalLiquido / dept.totalBruto) * 100}%`,
                                                }}
                                            />
                                            <div
                                                className="h-full bg-red-500"
                                                style={{
                                                    width: `${(dept.totalDeducciones / dept.totalBruto) * 100}%`,
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-emerald-500">
                                        Net{" "}
                                        {dept.totalBruto > 0
                                            ? `${((dept.totalLiquido / dept.totalBruto) * 100).toFixed(0)}%`
                                            : ""}
                                    </span>
                                    <span className="text-[10px] text-red-400">
                                        Ded.{" "}
                                        {dept.totalBruto > 0
                                            ? `${((dept.totalDeducciones / dept.totalBruto) * 100).toFixed(0)}%`
                                            : ""}
                                    </span>
                                </div>

                                <div className="flex items-center justify-center mt-2">
                                    {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 text-gray-500" />
                                    )}
                                </div>
                            </div>

                            {/* Expanded: employee list */}
                            {isExpanded && (
                                <div className="border-t border-gray-700/30 px-4 py-3 max-h-80 overflow-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-gray-500 uppercase">
                                                <th className="text-left py-1 font-medium">
                                                    Employee
                                                </th>
                                                <th className="text-right py-1 font-medium">Gross</th>
                                                <th className="text-right py-1 font-medium">Net</th>
                                                <th className="text-right py-1 font-medium">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deptEmployees.map((emp) => (
                                                <tr
                                                    key={emp.employeeId}
                                                    className="border-t border-gray-700/20"
                                                >
                                                    <td className="py-1.5 text-gray-300 dark:text-gray-200">
                                                        <span className="font-mono text-gray-500 mr-1.5">
                                                            {emp.employeeId}
                                                        </span>
                                                        {emp.fullName}
                                                    </td>
                                                    <td className="text-right py-1.5 font-mono text-green-400">
                                                        {fmtEur(emp.totalBruto)}
                                                    </td>
                                                    <td className="text-right py-1.5 font-mono text-emerald-400">
                                                        {fmtEur(emp.totalLiquido)}
                                                    </td>
                                                    <td className="text-right py-1.5 font-mono text-amber-400">
                                                        {fmtEur(emp.costeEmpresa)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════
// Monthly / Annual Overview
// ════════════════════════════════════════════════════════

function MonthlyView({
    monthlyData,
    selectedYear,
    employees,
}: {
    monthlyData: Record<string, PayrollData>;
    selectedYear: number;
    employees: PayrollEmployee[];
}) {
    const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());

    const toggleEmp = (id: string) => {
        setExpandedEmps((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Build unique employee list from all months of the selected year
    // Store full employee data per month for expansion
    const yearEmployees = useMemo(() => {
        const empMap = new Map<string, {
            fullName: string;
            department: string;
            months: Record<number, number>;
            monthDetails: Record<number, PayrollEmployee>;
        }>();

        // First populate from current loaded employees
        employees.forEach((emp) => {
            if (!empMap.has(emp.employeeId)) {
                empMap.set(emp.employeeId, {
                    fullName: emp.fullName,
                    department: emp.department,
                    months: {},
                    monthDetails: {},
                });
            }
        });

        // Then fill from monthlyData
        for (let m = 0; m < 12; m++) {
            const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
            const data = monthlyData[key];
            if (!data) continue;
            data.employees.forEach((emp) => {
                let entry = empMap.get(emp.employeeId);
                if (!entry) {
                    entry = { fullName: emp.fullName, department: emp.department, months: {}, monthDetails: {} };
                    empMap.set(emp.employeeId, entry);
                }
                entry.months[m] = emp.costeEmpresa;
                entry.monthDetails[m] = emp;
            });
        }

        return Array.from(empMap.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => a.department.localeCompare(b.department) || a.fullName.localeCompare(b.fullName));
    }, [monthlyData, selectedYear, employees]);

    // Find the latest month that has data for expansion fallback
    const latestMonthWithData = useMemo(() => {
        for (let m = 11; m >= 0; m--) {
            const key = `${selectedYear}-${String(m + 1).padStart(2, "0")}`;
            if (monthlyData[key]) return m;
        }
        return -1;
    }, [monthlyData, selectedYear]);

    // Month totals
    const monthTotals = useMemo(() => {
        const totals: number[] = new Array(12).fill(0);
        yearEmployees.forEach((emp) => {
            for (let m = 0; m < 12; m++) {
                totals[m] += emp.months[m] || 0;
            }
        });
        return totals;
    }, [yearEmployees]);

    const grandTotal = monthTotals.reduce((s, v) => s + v, 0);
    const totalCols = 15; // chevron + employee + dept + 12 months + total

    return (
        <div className="overflow-auto">
            <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#0a0a0a]">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="w-6 px-1 py-2.5"></th>
                        <th className="text-left px-2 py-2.5 text-xs text-gray-500 uppercase font-medium sticky left-0 bg-gray-100 dark:bg-[#0a0a0a] min-w-[200px]">
                            Employee
                        </th>
                        <th className="text-left px-2 py-2.5 text-xs text-gray-500 uppercase font-medium min-w-[100px]">
                            Dept
                        </th>
                        {MONTH_NAMES.map((m) => (
                            <th key={m} className="text-right px-2 py-2.5 text-xs text-gray-500 uppercase font-medium min-w-[80px]">
                                {m}
                            </th>
                        ))}
                        <th className="text-right px-2 py-2.5 text-xs text-gray-500 uppercase font-medium bg-gray-200/50 dark:bg-gray-800/50 min-w-[90px]">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {yearEmployees.map((emp) => {
                        const rowTotal = Object.values(emp.months).reduce((s, v) => s + v, 0);
                        const deptColor = getDeptColor(emp.department);
                        const isExpanded = expandedEmps.has(emp.id);
                        // Get concepts from the latest available month
                        const detailEmp = emp.monthDetails[latestMonthWithData] || Object.values(emp.monthDetails)[0];

                        return (
                            <React.Fragment key={emp.id}>
                                <tr
                                    onClick={() => toggleEmp(emp.id)}
                                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0a0a0a] cursor-pointer transition-colors"
                                >
                                    <td className="px-1 py-2">
                                        {isExpanded ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                                        ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                                        )}
                                    </td>
                                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-black">
                                        {emp.fullName}
                                    </td>
                                    <td className="px-2 py-2">
                                        <Badge className={`${deptColor.bg} ${deptColor.text} text-[10px] border ${deptColor.border}`}>
                                            {emp.department}
                                        </Badge>
                                    </td>
                                    {Array.from({ length: 12 }, (_, m) => (
                                        <td key={m} className="text-right px-2 py-2 font-mono text-amber-600 dark:text-amber-400">
                                            {emp.months[m] != null ? fmtEur(emp.months[m]) : (
                                                <span className="text-gray-300 dark:text-gray-700">—</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="text-right px-2 py-2 font-mono font-bold text-amber-500 bg-gray-50/50 dark:bg-gray-900/30">
                                        {rowTotal > 0 ? fmtEur(rowTotal) : "—"}
                                    </td>
                                </tr>

                                {/* Expanded: concept breakdown */}
                                {isExpanded && detailEmp && (
                                    <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
                                        <td colSpan={totalCols} className="px-6 py-4">
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-5xl">
                                                {/* Earnings */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                                        <TrendingUp className="h-3 w-3 text-green-500" />
                                                        Earnings
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {detailEmp.concepts
                                                            .filter((c) => !c.isDeduction)
                                                            .map((c, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400">
                                                                        <span className="font-mono text-gray-400 mr-2">{String(c.code).padStart(3, "0")}</span>
                                                                        {c.description}
                                                                    </span>
                                                                    <span className={`font-mono ${c.amount < 0 ? "text-red-400" : "text-green-500"}`}>
                                                                        {fmtEur(c.amount)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        <div className="flex justify-between text-xs font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                                            <span className="text-gray-900 dark:text-white">TOTAL GROSS</span>
                                                            <span className="text-green-500">{fmtEur(detailEmp.totalBruto)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Deductions */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                                        Deductions
                                                    </h4>
                                                    <div className="space-y-1">
                                                        {detailEmp.concepts
                                                            .filter((c) => c.isDeduction)
                                                            .map((c, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs">
                                                                    <span className="text-gray-600 dark:text-gray-400">
                                                                        <span className="font-mono text-gray-400 mr-2">{String(c.code).padStart(3, "0")}</span>
                                                                        {c.description}
                                                                    </span>
                                                                    <span className="font-mono text-red-400">{fmtEur(c.amount)}</span>
                                                                </div>
                                                            ))}
                                                        <div className="flex justify-between text-xs font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                                            <span className="text-gray-900 dark:text-white">TOTAL DEDUCTIONS</span>
                                                            <span className="text-red-400">{fmtEur(detailEmp.totalDeducciones)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Summary */}
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                                                        <Briefcase className="h-3 w-3 text-amber-500" />
                                                        Summary
                                                    </h4>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">Net (Liquid)</span>
                                                            <span className="font-mono font-bold text-emerald-400">{fmtEur(detailEmp.totalLiquido)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">SS Company</span>
                                                            <span className="font-mono font-bold text-blue-400">{fmtEur(detailEmp.ssEmpresa)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">SS Employee</span>
                                                            <span className="font-mono font-bold text-blue-300">{fmtEur(detailEmp.ssTrabajador)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs">
                                                            <span className="text-gray-500">IRPF ({fmtPct(detailEmp.irpfPercent)})</span>
                                                            <span className="font-mono font-bold text-orange-400">{fmtEur(detailEmp.irpf)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                                                            <span className="text-gray-900 dark:text-white font-semibold">Company Cost</span>
                                                            <span className="font-mono font-bold text-amber-400">{fmtEur(detailEmp.costeEmpresa)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Grand total row */}
                    <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#0a0a0a] font-medium sticky bottom-0">
                        <td className="px-1 py-3"></td>
                        <td className="px-2 py-3 font-semibold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-[#0a0a0a]">
                            TOTAL ({yearEmployees.length} employees)
                        </td>
                        <td className="px-2 py-3"></td>
                        {monthTotals.map((total, m) => (
                            <td key={m} className="text-right px-2 py-3 font-mono font-bold text-amber-400">
                                {total > 0 ? fmtEur(total) : "—"}
                            </td>
                        ))}
                        <td className="text-right px-2 py-3 font-mono font-bold text-amber-400 bg-gray-200/50 dark:bg-gray-800/50">
                            {grandTotal > 0 ? fmtEur(grandTotal) : "—"}
                        </td>
                    </tr>
                </tbody>
            </table>

            {yearEmployees.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <Calendar className="h-10 w-10 mb-2 opacity-40" />
                    <p className="text-sm">No data loaded for {selectedYear}</p>
                    <p className="text-xs text-gray-400 mt-1">Upload monthly payroll files to populate the annual overview</p>
                </div>
            )}
        </div>
    );
}
