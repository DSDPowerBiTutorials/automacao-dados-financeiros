"use client";

import React, { useState, useMemo, useRef } from "react";
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
    ChevronDown,
    ChevronRight,
    UserCheck,
    Briefcase,
    Building2,
    FileSpreadsheet,
} from "lucide-react";

// ════════════════════════════════════════════════════════
// Types & Mock Data
// ════════════════════════════════════════════════════════

interface Employee {
    id: string;
    name: string;
    role: string;
    department: string;
    location: string;
    startDate: string;
    status: "active" | "inactive";
    payroll: Record<string, number[]>; // year -> 12 monthly values
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MOCK_EMPLOYEES: Employee[] = [
    {
        id: "EMP-001", name: "María García López", role: "Senior Developer", department: "Engineering", location: "Madrid", startDate: "2021-03-15", status: "active",
        payroll: {
            "2025": [3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 3200, 6400],
            "2026": [3400, 3400, 3400, 3400, 3400, 3400, 3400, 3400, 3400, 3400, 3400, 6800],
        }
    },
    {
        id: "EMP-002", name: "Carlos Fernández Ruiz", role: "Product Manager", department: "Product", location: "Barcelona", startDate: "2020-06-01", status: "active",
        payroll: {
            "2025": [3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 7600],
            "2026": [4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 8000],
        }
    },
    {
        id: "EMP-003", name: "Ana Martínez Sánchez", role: "UX Designer", department: "Design", location: "Madrid", startDate: "2022-01-10", status: "active",
        payroll: {
            "2025": [2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 5600],
            "2026": [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 6000],
        }
    },
    {
        id: "EMP-004", name: "David López Herrera", role: "Backend Developer", department: "Engineering", location: "Valencia", startDate: "2023-04-20", status: "active",
        payroll: {
            "2025": [2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 5800],
            "2026": [3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 6200],
        }
    },
    {
        id: "EMP-005", name: "Laura Torres Vega", role: "Finance Manager", department: "Finance", location: "Madrid", startDate: "2019-09-01", status: "active",
        payroll: {
            "2025": [4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 8400],
            "2026": [4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 4500, 9000],
        }
    },
    {
        id: "EMP-006", name: "Javier Romero Gil", role: "DevOps Engineer", department: "Engineering", location: "Remote", startDate: "2022-07-15", status: "active",
        payroll: {
            "2025": [3500, 3500, 3500, 3500, 3500, 3500, 3500, 3500, 3500, 3500, 3500, 7000],
            "2026": [3700, 3700, 3700, 3700, 3700, 3700, 3700, 3700, 3700, 3700, 3700, 7400],
        }
    },
    {
        id: "EMP-007", name: "Isabel Navarro Ruiz", role: "Marketing Lead", department: "Marketing", location: "Barcelona", startDate: "2021-11-01", status: "active",
        payroll: {
            "2025": [3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 3100, 6200],
            "2026": [3300, 3300, 3300, 3300, 3300, 3300, 3300, 3300, 3300, 3300, 3300, 6600],
        }
    },
    {
        id: "EMP-008", name: "Miguel Ángel Santos", role: "QA Engineer", department: "Engineering", location: "Madrid", startDate: "2023-02-01", status: "active",
        payroll: {
            "2025": [2600, 2600, 2600, 2600, 2600, 2600, 2600, 2600, 2600, 2600, 2600, 5200],
            "2026": [2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 5600],
        }
    },
    {
        id: "EMP-009", name: "Patricia Díaz Moreno", role: "HR Manager", department: "People", location: "Madrid", startDate: "2020-01-15", status: "active",
        payroll: {
            "2025": [3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 7200],
            "2026": [3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 3800, 7600],
        }
    },
    {
        id: "EMP-010", name: "Roberto Jiménez Alonso", role: "Sales Director", department: "Sales", location: "Barcelona", startDate: "2019-05-01", status: "active",
        payroll: {
            "2025": [4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 4800, 9600],
            "2026": [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000, 10000],
        }
    },
    {
        id: "EMP-011", name: "Carmen Ruiz Delgado", role: "Customer Success", department: "Sales", location: "Remote", startDate: "2022-09-01", status: "active",
        payroll: {
            "2025": [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 5000],
            "2026": [2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 5400],
        }
    },
    {
        id: "EMP-012", name: "Fernando Blanco Reyes", role: "Data Analyst", department: "Finance", location: "Madrid", startDate: "2023-06-15", status: "active",
        payroll: {
            "2025": [2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 2700, 5400],
            "2026": [2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 2900, 5800],
        }
    },
    {
        id: "EMP-013", name: "Elena Vargas Prieto", role: "Office Manager", department: "Operations", location: "Madrid", startDate: "2021-08-01", status: "inactive",
        payroll: {
            "2025": [2200, 2200, 2200, 2200, 2200, 2200, 0, 0, 0, 0, 0, 0],
            "2026": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }
    },
    {
        id: "EMP-014", name: "Álvaro Medina Castro", role: "Frontend Developer", department: "Engineering", location: "Valencia", startDate: "2024-01-08", status: "active",
        payroll: {
            "2025": [2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 5600],
            "2026": [3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 3000, 6000],
        }
    },
    {
        id: "EMP-015", name: "Sofía Herrero Gómez", role: "Legal Counsel", department: "Legal", location: "Madrid", startDate: "2022-03-01", status: "active",
        payroll: {
            "2025": [4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 8000],
            "2026": [4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 4200, 8400],
        }
    },
];

// ════════════════════════════════════════════════════════
// Formatters
// ════════════════════════════════════════════════════════

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatCompactCurrency(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M €`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K €`;
    return formatCurrency(value);
}

// ════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════

export default function PayrollPage() {
    const [selectedYear, setSelectedYear] = useState<"2025" | "2026">("2025");
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Filtered employees ───
    const filteredEmployees = useMemo(() => {
        return MOCK_EMPLOYEES.filter(emp => {
            if (statusFilter !== "all" && emp.status !== statusFilter) return false;
            if (departmentFilter !== "all" && emp.department !== departmentFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return emp.name.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q) || emp.id.toLowerCase().includes(q);
            }
            return true;
        });
    }, [searchQuery, departmentFilter, statusFilter]);

    // ─── Summary KPIs ───
    const summary = useMemo(() => {
        const activeCount = MOCK_EMPLOYEES.filter(e => e.status === "active").length;
        const inactiveCount = MOCK_EMPLOYEES.filter(e => e.status === "inactive").length;
        const totalAnnual = filteredEmployees.reduce((sum, emp) => {
            const yearly = emp.payroll[selectedYear] || [];
            return sum + yearly.reduce((s, v) => s + v, 0);
        }, 0);
        const monthlyAvg = totalAnnual / 12;
        const departments = [...new Set(MOCK_EMPLOYEES.map(e => e.department))];

        // Per-month totals
        const monthlyTotals = MONTHS.map((_, i) =>
            filteredEmployees.reduce((sum, emp) => sum + ((emp.payroll[selectedYear] || [])[i] || 0), 0)
        );

        return { activeCount, inactiveCount, totalAnnual, monthlyAvg, departments, monthlyTotals };
    }, [filteredEmployees, selectedYear]);

    const departments = useMemo(() => [...new Set(MOCK_EMPLOYEES.map(e => e.department))].sort(), []);

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Placeholder — would parse xlsx and update state
        alert(`File selected: ${file.name}\n\nXLSX parsing will be implemented with backend integration.`);
        e.target.value = "";
    };

    const exportCSV = () => {
        const headers = ["ID", "Name", "Role", "Department", "Location", "Status", ...MONTHS.map(m => `${m} ${selectedYear}`), "Annual Total"];
        const csvRows = [headers.join(",")];
        filteredEmployees.forEach(emp => {
            const yearly = emp.payroll[selectedYear] || [];
            const annual = yearly.reduce((s, v) => s + v, 0);
            csvRows.push([
                emp.id,
                `"${emp.name}"`,
                `"${emp.role}"`,
                emp.department,
                emp.location,
                emp.status,
                ...yearly.map(v => v.toFixed(2)),
                annual.toFixed(2),
            ].join(","));
        });
        const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${selectedYear}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black text-gray-900 dark:text-white">
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />

            {/* ─── Header ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-black">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Users className="h-5 w-5 text-violet-500" />
                            Payroll Management
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {summary.activeCount} active employees · {filteredEmployees.length} showing
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Year toggle */}
                        <div className="flex items-center bg-gray-100 dark:bg-[#0a0a0a] rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                            {(["2025", "2026"] as const).map(year => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedYear === year
                                            ? "bg-violet-600 text-white shadow-sm"
                                            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        {/* Upload XLSX */}
                        <Button size="sm" variant="outline" onClick={handleUploadClick} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <Upload className="h-4 w-4 mr-1" />
                            <FileSpreadsheet className="h-4 w-4 mr-1" />
                            Upload XLSX
                        </Button>
                        {/* Export */}
                        <Button size="sm" variant="outline" onClick={exportCSV} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                            <Download className="h-4 w-4 mr-1" /> Export
                        </Button>
                    </div>
                </div>
                {/* Search & filter bar */}
                <div className="flex items-center gap-3 mt-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <Input placeholder="Search by name, role or ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-64 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-500" />
                    </div>
                    <select
                        value={departmentFilter}
                        onChange={e => setDepartmentFilter(e.target.value)}
                        className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white"
                    >
                        <option value="all">All Departments</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* ─── KPI Bar ─── */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
                <div className="grid grid-cols-5 gap-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-violet-500 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Active</p>
                            <p className="text-sm font-bold text-violet-400">{summary.activeCount}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Inactive</p>
                            <p className="text-sm font-bold text-gray-400">{summary.inactiveCount}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Annual Total ({selectedYear})</p>
                            <p className="text-sm font-bold text-green-400">{formatCompactCurrency(summary.totalAnnual)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Monthly Avg</p>
                            <p className="text-sm font-bold text-blue-400">{formatCompactCurrency(summary.monthlyAvg)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Departments</p>
                            <p className="text-sm font-bold text-amber-400">{summary.departments.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Main Table ─── */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-[#0a0a0a]">
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left px-4 py-2.5 text-xs text-gray-500 uppercase font-medium w-8"></th>
                            <th className="text-left px-4 py-2.5 text-xs text-gray-500 uppercase font-medium">Employee</th>
                            <th className="text-left px-4 py-2.5 text-xs text-gray-500 uppercase font-medium">Department</th>
                            <th className="text-left px-4 py-2.5 text-xs text-gray-500 uppercase font-medium">Location</th>
                            <th className="text-center px-2 py-2.5 text-xs text-gray-500 uppercase font-medium">Status</th>
                            {MONTHS.map(m => (
                                <th key={m} className="text-right px-2 py-2.5 text-xs text-gray-500 uppercase font-medium w-20">{m}</th>
                            ))}
                            <th className="text-right px-4 py-2.5 text-xs text-gray-500 uppercase font-medium bg-gray-200/50 dark:bg-gray-800/50">Annual</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEmployees.map(emp => {
                            const yearly = emp.payroll[selectedYear] || [];
                            const annual = yearly.reduce((s, v) => s + v, 0);
                            const isExpanded = expandedRows.has(emp.id);
                            return (
                                <React.Fragment key={emp.id}>
                                    <tr
                                        onClick={() => toggleRow(emp.id)}
                                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-[#0a0a0a] cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-2.5">
                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{emp.name}</p>
                                                <p className="text-xs text-gray-500">{emp.role}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{emp.department}</td>
                                        <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{emp.location}</td>
                                        <td className="px-2 py-2.5 text-center">
                                            {emp.status === "active" ? (
                                                <Badge className="bg-emerald-900/30 text-emerald-400 text-xs border border-emerald-700/50">Active</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-gray-400 text-xs border-gray-600">Inactive</Badge>
                                            )}
                                        </td>
                                        {yearly.map((val, i) => (
                                            <td key={i} className={`text-right px-2 py-2.5 font-mono text-xs ${val > 0 ? "text-gray-900 dark:text-gray-200" : "text-gray-400"}`}>
                                                {val > 0 ? formatCurrency(val) : "—"}
                                            </td>
                                        ))}
                                        <td className="text-right px-4 py-2.5 font-mono font-medium text-green-500 bg-gray-50/50 dark:bg-gray-900/30">
                                            {annual > 0 ? formatCurrency(annual) : "—"}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
                                            <td colSpan={17} className="px-8 py-3">
                                                <div className="grid grid-cols-4 gap-4 text-xs">
                                                    <div>
                                                        <span className="text-gray-500">ID:</span> <span className="text-gray-900 dark:text-white font-mono">{emp.id}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Start Date:</span> <span className="text-gray-900 dark:text-white">{new Date(emp.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Annual Gross:</span> <span className="text-green-400 font-medium">{formatCurrency(annual)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500">Monthly Avg:</span> <span className="text-blue-400 font-medium">{formatCurrency(annual / 12)}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {/* Totals row */}
                        <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-[#0a0a0a] font-medium sticky bottom-0">
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3 text-gray-900 dark:text-white">TOTAL ({filteredEmployees.length} employees)</td>
                            <td className="px-4 py-3"></td>
                            <td className="px-4 py-3"></td>
                            <td className="px-2 py-3"></td>
                            {summary.monthlyTotals.map((val, i) => (
                                <td key={i} className="text-right px-2 py-3 font-mono text-xs text-violet-500">
                                    {val > 0 ? formatCurrency(val) : "—"}
                                </td>
                            ))}
                            <td className="text-right px-4 py-3 font-mono font-bold text-green-400 bg-gray-200/50 dark:bg-gray-800/50">
                                {formatCurrency(summary.totalAnnual)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
