"use client";

import { useState, useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Download,
    Building2,
    ChevronDown,
    ChevronRight,
    Filter,
    BarChart3,
    Layers,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    Eye,
    EyeOff,
    Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    ResponsiveContainer,
    Legend,
    Cell,
    PieChart,
    Pie,
    Tooltip as RechartsTooltip,
    LineChart,
    Line,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthlyValues {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

interface PnLLine {
    code: string;
    name: string;
    type: "revenue" | "expense" | "subtotal" | "total" | "header";
    level: number;
    actual: MonthlyValues;
    budget: MonthlyValues;
    children?: PnLLine[];
}

interface Department {
    id: string;
    name: string;
    code: string;
    color: string;
    icon: string;
    headcount: number;
    lines: PnLLine[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const emptyMonthly = (): MonthlyValues => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
});

const monthKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const getMonthVal = (m: MonthlyValues, idx: number) => m[monthKeys[idx]];

const sumAll = (m: MonthlyValues) => monthKeys.reduce((s, k) => s + m[k], 0);

const getYTD = (m: MonthlyValues, upTo: number) =>
    monthKeys.slice(0, upTo + 1).reduce((s, k) => s + m[k], 0);

const fmt = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(1)}K`;
    return `€${v.toFixed(0)}`;
};

const fmtFull = (v: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const pct = (actual: number, budget: number) => {
    if (budget === 0) return actual === 0 ? 0 : 100;
    return ((actual - budget) / Math.abs(budget)) * 100;
};

// ── Mock Data Generator ────────────────────────────────────────────────────

function generateMonthly(base: number, variance: number = 0.15, trend: number = 0): MonthlyValues {
    const vals: number[] = [];
    for (let i = 0; i < 12; i++) {
        const seasonal = 1 + Math.sin((i - 1) * Math.PI / 6) * 0.08;
        const trendFactor = 1 + (trend * i / 12);
        const random = 1 + (Math.random() - 0.5) * variance;
        vals.push(Math.round(base * seasonal * trendFactor * random));
    }
    return { jan: vals[0], feb: vals[1], mar: vals[2], apr: vals[3], may: vals[4], jun: vals[5], jul: vals[6], aug: vals[7], sep: vals[8], oct: vals[9], nov: vals[10], dec: vals[11] };
}

function generateBudget(actual: MonthlyValues, accuracy: number = 0.9): MonthlyValues {
    const result = emptyMonthly();
    for (const k of monthKeys) {
        result[k] = Math.round(actual[k] * (accuracy + (Math.random() - 0.5) * 0.2));
    }
    return result;
}

function sumMonthlyLines(lines: PnLLine[], type: "actual" | "budget"): MonthlyValues {
    const result = emptyMonthly();
    for (const line of lines) {
        if (line.type === "subtotal" || line.type === "total" || line.type === "header") continue;
        for (const k of monthKeys) {
            result[k] += line[type][k];
        }
    }
    return result;
}

// ── Department Mock Data ───────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
    {
        id: "clinical",
        name: "Clinical Operations",
        code: "CLIN",
        color: "#3b82f6",
        icon: "🏥",
        headcount: 45,
        lines: [
            { code: "CLIN-R01", name: "Patient Treatments", type: "revenue", level: 0, actual: generateMonthly(185000, 0.12, 0.05), budget: emptyMonthly() },
            { code: "CLIN-R02", name: "Consultation Fees", type: "revenue", level: 0, actual: generateMonthly(42000, 0.15, 0.03), budget: emptyMonthly() },
            { code: "CLIN-R03", name: "Follow-up Services", type: "revenue", level: 0, actual: generateMonthly(28000, 0.18, 0.02), budget: emptyMonthly() },
            { code: "CLIN-E01", name: "Salaries & Wages", type: "expense", level: 0, actual: generateMonthly(95000, 0.03, 0.02), budget: emptyMonthly() },
            { code: "CLIN-E02", name: "Medical Supplies", type: "expense", level: 0, actual: generateMonthly(32000, 0.2, 0.01), budget: emptyMonthly() },
            { code: "CLIN-E03", name: "Equipment Maintenance", type: "expense", level: 0, actual: generateMonthly(8500, 0.25, 0), budget: emptyMonthly() },
            { code: "CLIN-E04", name: "Lab & Diagnostics", type: "expense", level: 0, actual: generateMonthly(12000, 0.15, 0.03), budget: emptyMonthly() },
            { code: "CLIN-E05", name: "Insurance & Compliance", type: "expense", level: 0, actual: generateMonthly(6500, 0.05, 0.01), budget: emptyMonthly() },
            { code: "CLIN-E06", name: "Training & Development", type: "expense", level: 0, actual: generateMonthly(4200, 0.3, 0), budget: emptyMonthly() },
        ],
    },
    {
        id: "education",
        name: "Education & Training",
        code: "EDU",
        color: "#8b5cf6",
        icon: "🎓",
        headcount: 18,
        lines: [
            { code: "EDU-R01", name: "Course Fees (Online)", type: "revenue", level: 0, actual: generateMonthly(120000, 0.15, 0.08), budget: emptyMonthly() },
            { code: "EDU-R02", name: "Workshop Revenue", type: "revenue", level: 0, actual: generateMonthly(65000, 0.2, 0.05), budget: emptyMonthly() },
            { code: "EDU-R03", name: "Certification Programs", type: "revenue", level: 0, actual: generateMonthly(35000, 0.18, 0.1), budget: emptyMonthly() },
            { code: "EDU-R04", name: "Licensing & Royalties", type: "revenue", level: 0, actual: generateMonthly(15000, 0.1, 0.12), budget: emptyMonthly() },
            { code: "EDU-E01", name: "Instructor Salaries", type: "expense", level: 0, actual: generateMonthly(48000, 0.05, 0.02), budget: emptyMonthly() },
            { code: "EDU-E02", name: "Content Production", type: "expense", level: 0, actual: generateMonthly(22000, 0.25, 0.05), budget: emptyMonthly() },
            { code: "EDU-E03", name: "Platform & Tools", type: "expense", level: 0, actual: generateMonthly(8500, 0.1, 0.03), budget: emptyMonthly() },
            { code: "EDU-E04", name: "Marketing (Education)", type: "expense", level: 0, actual: generateMonthly(18000, 0.2, 0.04), budget: emptyMonthly() },
            { code: "EDU-E05", name: "Travel & Events", type: "expense", level: 0, actual: generateMonthly(12000, 0.35, 0), budget: emptyMonthly() },
        ],
    },
    {
        id: "technology",
        name: "Technology & Digital",
        code: "TECH",
        color: "#06b6d4",
        icon: "💻",
        headcount: 12,
        lines: [
            { code: "TECH-R01", name: "Software Subscriptions", type: "revenue", level: 0, actual: generateMonthly(45000, 0.08, 0.15), budget: emptyMonthly() },
            { code: "TECH-R02", name: "Custom Development", type: "revenue", level: 0, actual: generateMonthly(25000, 0.3, 0.05), budget: emptyMonthly() },
            { code: "TECH-E01", name: "Engineering Salaries", type: "expense", level: 0, actual: generateMonthly(55000, 0.03, 0.03), budget: emptyMonthly() },
            { code: "TECH-E02", name: "Cloud Infrastructure", type: "expense", level: 0, actual: generateMonthly(12000, 0.1, 0.08), budget: emptyMonthly() },
            { code: "TECH-E03", name: "Software Licenses", type: "expense", level: 0, actual: generateMonthly(8000, 0.08, 0.05), budget: emptyMonthly() },
            { code: "TECH-E04", name: "Cybersecurity", type: "expense", level: 0, actual: generateMonthly(4500, 0.12, 0.02), budget: emptyMonthly() },
            { code: "TECH-E05", name: "Hardware & Equipment", type: "expense", level: 0, actual: generateMonthly(3500, 0.4, 0), budget: emptyMonthly() },
        ],
    },
    {
        id: "marketing",
        name: "Marketing & Sales",
        code: "MKT",
        color: "#f59e0b",
        icon: "📣",
        headcount: 15,
        lines: [
            { code: "MKT-R01", name: "Lead Generation Revenue", type: "revenue", level: 0, actual: generateMonthly(38000, 0.2, 0.06), budget: emptyMonthly() },
            { code: "MKT-R02", name: "Partnership Commissions", type: "revenue", level: 0, actual: generateMonthly(15000, 0.25, 0.04), budget: emptyMonthly() },
            { code: "MKT-E01", name: "Team Salaries", type: "expense", level: 0, actual: generateMonthly(42000, 0.03, 0.02), budget: emptyMonthly() },
            { code: "MKT-E02", name: "Digital Advertising", type: "expense", level: 0, actual: generateMonthly(28000, 0.2, 0.05), budget: emptyMonthly() },
            { code: "MKT-E03", name: "Events & Sponsorships", type: "expense", level: 0, actual: generateMonthly(15000, 0.35, 0.02), budget: emptyMonthly() },
            { code: "MKT-E04", name: "Branding & Design", type: "expense", level: 0, actual: generateMonthly(8000, 0.2, 0), budget: emptyMonthly() },
            { code: "MKT-E05", name: "CRM & Tools", type: "expense", level: 0, actual: generateMonthly(5500, 0.08, 0.03), budget: emptyMonthly() },
        ],
    },
    {
        id: "admin",
        name: "General & Admin",
        code: "G&A",
        color: "#64748b",
        icon: "🏢",
        headcount: 10,
        lines: [
            { code: "GA-R01", name: "Internal Services", type: "revenue", level: 0, actual: generateMonthly(5000, 0.15, 0), budget: emptyMonthly() },
            { code: "GA-E01", name: "Admin Salaries", type: "expense", level: 0, actual: generateMonthly(35000, 0.03, 0.02), budget: emptyMonthly() },
            { code: "GA-E02", name: "Office Rent & Utilities", type: "expense", level: 0, actual: generateMonthly(18000, 0.02, 0.01), budget: emptyMonthly() },
            { code: "GA-E03", name: "Accounting & Legal", type: "expense", level: 0, actual: generateMonthly(12000, 0.15, 0.02), budget: emptyMonthly() },
            { code: "GA-E04", name: "Office Supplies", type: "expense", level: 0, actual: generateMonthly(3500, 0.25, 0), budget: emptyMonthly() },
            { code: "GA-E05", name: "Travel & Expenses", type: "expense", level: 0, actual: generateMonthly(6000, 0.3, 0), budget: emptyMonthly() },
            { code: "GA-E06", name: "Depreciation", type: "expense", level: 0, actual: generateMonthly(4500, 0.02, 0), budget: emptyMonthly() },
        ],
    },
    {
        id: "hr",
        name: "Human Resources",
        code: "HR",
        color: "#ec4899",
        icon: "👥",
        headcount: 5,
        lines: [
            { code: "HR-E01", name: "HR Team Salaries", type: "expense", level: 0, actual: generateMonthly(18000, 0.03, 0.02), budget: emptyMonthly() },
            { code: "HR-E02", name: "Recruitment Costs", type: "expense", level: 0, actual: generateMonthly(8000, 0.35, 0.03), budget: emptyMonthly() },
            { code: "HR-E03", name: "Benefits & Perks", type: "expense", level: 0, actual: generateMonthly(15000, 0.05, 0.02), budget: emptyMonthly() },
            { code: "HR-E04", name: "Training Programs", type: "expense", level: 0, actual: generateMonthly(5000, 0.3, 0), budget: emptyMonthly() },
            { code: "HR-E05", name: "HR Software", type: "expense", level: 0, actual: generateMonthly(2500, 0.05, 0.01), budget: emptyMonthly() },
        ],
    },
];

// Generate budget after actual 
DEPARTMENTS.forEach(dept => {
    dept.lines.forEach(line => {
        line.budget = generateBudget(line.actual, line.type === "revenue" ? 0.95 : 1.05);
    });
});

// ── Computed Department Summaries ──────────────────────────────────────────

function getDeptSummary(dept: Department) {
    const revenueLines = dept.lines.filter(l => l.type === "revenue");
    const expenseLines = dept.lines.filter(l => l.type === "expense");
    const revenue = sumMonthlyLines(revenueLines, "actual");
    const expenses = sumMonthlyLines(expenseLines, "actual");
    const revenueBudget = sumMonthlyLines(revenueLines, "budget");
    const expensesBudget = sumMonthlyLines(expenseLines, "budget");
    const net = emptyMonthly();
    const netBudget = emptyMonthly();
    for (const k of monthKeys) {
        net[k] = revenue[k] - expenses[k];
        netBudget[k] = revenueBudget[k] - expensesBudget[k];
    }
    return { revenue, expenses, net, revenueBudget, expensesBudget, netBudget };
}

// ── Main Component ────────────────────────────────────────────────────────

export default function DepartmentalPnLPage() {
    const [selectedYear, setSelectedYear] = useState("2026");
    const [selectedDept, setSelectedDept] = useState<string>("all");
    const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set(["clinical", "education"]));
    const [showBudget, setShowBudget] = useState(true);
    const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "ytd">("monthly");
    const currentMonth = new Date().getMonth(); // 0-indexed

    // Toggle department expansion
    const toggleDept = (id: string) => {
        setExpandedDepts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const expandAll = () => setExpandedDepts(new Set(DEPARTMENTS.map(d => d.id)));
    const collapseAll = () => setExpandedDepts(new Set());

    // Filter departments
    const filteredDepts = useMemo(() =>
        selectedDept === "all" ? DEPARTMENTS : DEPARTMENTS.filter(d => d.id === selectedDept),
        [selectedDept]
    );

    // Consolidated totals
    const consolidated = useMemo(() => {
        const totals = {
            revenue: emptyMonthly(),
            expenses: emptyMonthly(),
            net: emptyMonthly(),
            revenueBudget: emptyMonthly(),
            expensesBudget: emptyMonthly(),
            netBudget: emptyMonthly(),
        };
        for (const dept of filteredDepts) {
            const s = getDeptSummary(dept);
            for (const k of monthKeys) {
                totals.revenue[k] += s.revenue[k];
                totals.expenses[k] += s.expenses[k];
                totals.net[k] += s.net[k];
                totals.revenueBudget[k] += s.revenueBudget[k];
                totals.expensesBudget[k] += s.expensesBudget[k];
                totals.netBudget[k] += s.netBudget[k];
            }
        }
        return totals;
    }, [filteredDepts]);

    // Chart data: department comparison
    const barChartData = useMemo(() => {
        return filteredDepts.map(dept => {
            const s = getDeptSummary(dept);
            return {
                name: dept.code,
                fullName: dept.name,
                revenue: sumAll(s.revenue),
                expenses: sumAll(s.expenses),
                net: sumAll(s.net),
                color: dept.color,
            };
        });
    }, [filteredDepts]);

    // Chart data: monthly trend
    const trendData = useMemo(() => {
        return MONTHS.map((label, i) => ({
            month: label,
            revenue: getMonthVal(consolidated.revenue, i),
            expenses: getMonthVal(consolidated.expenses, i),
            net: getMonthVal(consolidated.net, i),
            revenueBudget: getMonthVal(consolidated.revenueBudget, i),
        }));
    }, [consolidated]);

    // Chart data: expense pie by department
    const pieData = useMemo(() => {
        return filteredDepts.map(dept => {
            const s = getDeptSummary(dept);
            return {
                name: dept.name,
                value: sumAll(s.expenses),
                color: dept.color,
            };
        });
    }, [filteredDepts]);

    // KPIs
    const totalRevenue = sumAll(consolidated.revenue);
    const totalExpenses = sumAll(consolidated.expenses);
    const totalNet = sumAll(consolidated.net);
    const totalRevenueBudget = sumAll(consolidated.revenueBudget);
    const totalExpensesBudget = sumAll(consolidated.expensesBudget);
    const totalNetBudget = sumAll(consolidated.netBudget);
    const margin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;
    const totalHeadcount = filteredDepts.reduce((s, d) => s + d.headcount, 0);
    const revenuePerHead = totalHeadcount > 0 ? totalRevenue / totalHeadcount : 0;

    // ── Export CSV ──
    function handleExport() {
        const headers = ["Department", "Code", "Line Item", "Type", ...MONTHS, "Total", "Budget Total", "Variance %"];
        const rows: string[][] = [];

        for (const dept of filteredDepts) {
            const s = getDeptSummary(dept);
            // Revenue header
            rows.push([dept.name, dept.code, "── REVENUE ──", "header", ...MONTHS.map(() => ""), "", "", ""]);
            for (const line of dept.lines.filter(l => l.type === "revenue")) {
                rows.push([
                    dept.name, line.code, line.name, line.type,
                    ...monthKeys.map(k => String(line.actual[k])),
                    String(sumAll(line.actual)),
                    String(sumAll(line.budget)),
                    pct(sumAll(line.actual), sumAll(line.budget)).toFixed(1) + "%",
                ]);
            }
            rows.push([dept.name, "", "Total Revenue", "subtotal", ...monthKeys.map(k => String(s.revenue[k])), String(sumAll(s.revenue)), String(sumAll(s.revenueBudget)), ""]);
            // Expense header
            rows.push([dept.name, dept.code, "── EXPENSES ──", "header", ...MONTHS.map(() => ""), "", "", ""]);
            for (const line of dept.lines.filter(l => l.type === "expense")) {
                rows.push([
                    dept.name, line.code, line.name, line.type,
                    ...monthKeys.map(k => String(line.actual[k])),
                    String(sumAll(line.actual)),
                    String(sumAll(line.budget)),
                    pct(sumAll(line.actual), sumAll(line.budget)).toFixed(1) + "%",
                ]);
            }
            rows.push([dept.name, "", "Total Expenses", "subtotal", ...monthKeys.map(k => String(s.expenses[k])), String(sumAll(s.expenses)), String(sumAll(s.expensesBudget)), ""]);
            rows.push([dept.name, "", "NET RESULT", "total", ...monthKeys.map(k => String(s.net[k])), String(sumAll(s.net)), String(sumAll(s.netBudget)), ""]);
            rows.push([]); // spacer
        }

        const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `departmental-pnl-${selectedYear}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Quarterly aggregation helper ──
    function getQuarterlyFromMonthly(m: MonthlyValues): number[] {
        return [
            m.jan + m.feb + m.mar,
            m.apr + m.may + m.jun,
            m.jul + m.aug + m.sep,
            m.oct + m.nov + m.dec,
        ];
    }

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black px-4 py-6 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BarChart3 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                            P&L Departamental
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Demonstração de Resultados por Departamento — Dados Mock
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[100px] bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                                <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0a0a0a]">
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={selectedDept} onValueChange={setSelectedDept}>
                            <SelectTrigger className="w-[200px] bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                                <Filter className="h-4 w-4 mr-1 text-gray-400" />
                                <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0a0a0a]">
                                <SelectItem value="all">All Departments</SelectItem>
                                {DEPARTMENTS.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.icon} {d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={viewMode} onValueChange={(v: "monthly" | "quarterly" | "ytd") => setViewMode(v)}>
                            <SelectTrigger className="w-[130px] bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-gray-700">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0a0a0a]">
                                <SelectItem value="monthly">Mensal</SelectItem>
                                <SelectItem value="quarterly">Trimestral</SelectItem>
                                <SelectItem value="ytd">YTD</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowBudget(!showBudget)}
                            className="border-gray-200 dark:border-gray-700"
                        >
                            {showBudget ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                            Budget
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport} className="border-gray-200 dark:border-gray-700">
                            <Download className="h-4 w-4 mr-1" />
                            Export
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <KPICard
                    title="Revenue Total"
                    value={fmtFull(totalRevenue)}
                    budget={showBudget ? fmtFull(totalRevenueBudget) : undefined}
                    variance={pct(totalRevenue, totalRevenueBudget)}
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="text-green-600 dark:text-green-400"
                />
                <KPICard
                    title="Expenses Total"
                    value={fmtFull(totalExpenses)}
                    budget={showBudget ? fmtFull(totalExpensesBudget) : undefined}
                    variance={pct(totalExpenses, totalExpensesBudget)}
                    invertVariance
                    icon={<TrendingDown className="h-5 w-5" />}
                    color="text-red-500 dark:text-red-400"
                />
                <KPICard
                    title="Net Result"
                    value={fmtFull(totalNet)}
                    budget={showBudget ? fmtFull(totalNetBudget) : undefined}
                    variance={pct(totalNet, totalNetBudget)}
                    icon={<DollarSign className="h-5 w-5" />}
                    color={totalNet >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}
                />
                <KPICard
                    title="Margin"
                    value={`${margin.toFixed(1)}%`}
                    icon={<BarChart3 className="h-5 w-5" />}
                    color="text-blue-600 dark:text-blue-400"
                />
                <KPICard
                    title="Headcount"
                    value={String(totalHeadcount)}
                    icon={<Building2 className="h-5 w-5" />}
                    color="text-purple-600 dark:text-purple-400"
                />
                <KPICard
                    title="Revenue / FTE"
                    value={fmtFull(revenuePerHead)}
                    icon={<Layers className="h-5 w-5" />}
                    color="text-amber-600 dark:text-amber-400"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* Monthly Trend */}
                <Card className="lg:col-span-2 bg-white dark:bg-black border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Tendência Mensal — Revenue vs Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--input-border, #e5e7eb)" />
                                <XAxis dataKey="month" tick={{ fill: "var(--header-text, #6b7280)", fontSize: 12 }} />
                                <YAxis tickFormatter={fmt} tick={{ fill: "var(--header-text, #6b7280)", fontSize: 12 }} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: 8 }}
                                    labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                    formatter={(v: number) => fmtFull(v)}
                                />
                                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
                                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} dot={false} name="Expenses" />
                                <Line type="monotone" dataKey="net" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Net" />
                                {showBudget && (
                                    <Line type="monotone" dataKey="revenueBudget" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="3 3" opacity={0.5} name="Revenue Budget" />
                                )}
                                <Legend wrapperStyle={{ color: "var(--header-text, #6b7280)", fontSize: 12 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Expense Distribution Pie */}
                <Card className="bg-white dark:bg-black border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Distribuição de Despesas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={90}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                    fontSize={11}
                                >
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: 8 }}
                                    formatter={(v: number) => fmtFull(v)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Department Comparison Bar Chart */}
            {selectedDept === "all" && (
                <Card className="mb-6 bg-white dark:bg-black border-gray-200 dark:border-gray-700">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Comparação entre Departamentos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={barChartData} barGap={4}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--input-border, #e5e7eb)" />
                                <XAxis dataKey="name" tick={{ fill: "var(--header-text, #6b7280)", fontSize: 12 }} />
                                <YAxis tickFormatter={fmt} tick={{ fill: "var(--header-text, #6b7280)", fontSize: 12 }} />
                                <RechartsTooltip
                                    contentStyle={{ backgroundColor: "var(--content-bg, #ffffff)", border: "1px solid var(--input-border, #e5e7eb)", borderRadius: 8 }}
                                    labelStyle={{ color: "var(--header-text, #6b7280)" }}
                                    formatter={(v: number, name: string) => [fmtFull(v), name]}
                                />
                                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="net" name="Net" radius={[4, 4, 0, 0]}>
                                    {barChartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.net >= 0 ? "#3b82f6" : "#f97316"} />
                                    ))}
                                </Bar>
                                <Legend wrapperStyle={{ color: "var(--header-text, #6b7280)", fontSize: 12 }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs text-gray-500 dark:text-gray-400">
                        Expand All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs text-gray-500 dark:text-gray-400">
                        Collapse All
                    </Button>
                </div>
                <Badge variant="outline" className="text-xs text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600">
                    {filteredDepts.length} department{filteredDepts.length !== 1 ? "s" : ""}
                </Badge>
            </div>

            {/* Department P&L Tables */}
            <div className="space-y-4">
                {filteredDepts.map(dept => (
                    <DepartmentCard
                        key={dept.id}
                        dept={dept}
                        expanded={expandedDepts.has(dept.id)}
                        onToggle={() => toggleDept(dept.id)}
                        showBudget={showBudget}
                        viewMode={viewMode}
                        currentMonth={currentMonth}
                        getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                    />
                ))}
            </div>

            {/* Consolidated Total */}
            <Card className="mt-6 bg-white dark:bg-black border-gray-200 dark:border-gray-700 border-t-4 border-t-blue-500">
                <CardContent className="pt-4">
                    <ConsolidatedRow
                        label="CONSOLIDATED REVENUE"
                        actual={consolidated.revenue}
                        budget={consolidated.revenueBudget}
                        showBudget={showBudget}
                        viewMode={viewMode}
                        currentMonth={currentMonth}
                        type="revenue"
                        getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                    />
                    <ConsolidatedRow
                        label="CONSOLIDATED EXPENSES"
                        actual={consolidated.expenses}
                        budget={consolidated.expensesBudget}
                        showBudget={showBudget}
                        viewMode={viewMode}
                        currentMonth={currentMonth}
                        type="expense"
                        getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                    />
                    <div className="border-t-2 border-gray-300 dark:border-gray-600 mt-2 pt-2">
                        <ConsolidatedRow
                            label="CONSOLIDATED NET RESULT"
                            actual={consolidated.net}
                            budget={consolidated.netBudget}
                            showBudget={showBudget}
                            viewMode={viewMode}
                            currentMonth={currentMonth}
                            type="total"
                            getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Footer with mock data notice */}
            <div className="mt-6 text-center">
                <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600">
                    ⚠️ Mock Data — Os valores apresentados são fictícios para demonstração
                </Badge>
            </div>
        </div>
    );
}

// ── KPI Card Component ────────────────────────────────────────────────────

function KPICard({
    title, value, budget, variance, invertVariance, icon, color,
}: {
    title: string; value: string; budget?: string; variance?: number; invertVariance?: boolean; icon: React.ReactNode; color: string;
}) {
    const isGood = invertVariance ? (variance ?? 0) <= 0 : (variance ?? 0) >= 0;

    return (
        <Card className="bg-white dark:bg-black border-gray-200 dark:border-gray-700">
            <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{title}</span>
                    <span className={color}>{icon}</span>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
                {budget && (
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">Budget: {budget}</span>
                        {variance !== undefined && (
                            <span className={`text-[10px] font-medium flex items-center ${isGood ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                                {isGood ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {Math.abs(variance).toFixed(1)}%
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ── Department Card ───────────────────────────────────────────────────────

function DepartmentCard({
    dept, expanded, onToggle, showBudget, viewMode, currentMonth, getQuarterlyFromMonthly,
}: {
    dept: Department; expanded: boolean; onToggle: () => void; showBudget: boolean;
    viewMode: "monthly" | "quarterly" | "ytd"; currentMonth: number;
    getQuarterlyFromMonthly: (m: MonthlyValues) => number[];
}) {
    const summary = useMemo(() => getDeptSummary(dept), [dept]);
    const totalRevenue = sumAll(summary.revenue);
    const totalExpenses = sumAll(summary.expenses);
    const totalNet = sumAll(summary.net);
    const deptMargin = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

    const colHeaders = viewMode === "monthly"
        ? MONTHS
        : viewMode === "quarterly"
            ? ["Q1", "Q2", "Q3", "Q4"]
            : ["YTD"];

    return (
        <Card className="bg-white dark:bg-black border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Department Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#111111]/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 rounded-full" style={{ backgroundColor: dept.color }} />
                    <span className="text-xl">{dept.icon}</span>
                    <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{dept.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {dept.code} · {dept.headcount} FTEs · Margin: {deptMargin.toFixed(1)}%
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600 dark:text-green-400 font-medium">{fmt(totalRevenue)}</span>
                            <span className="text-red-500 dark:text-red-400 font-medium">{fmt(totalExpenses)}</span>
                            <span className={`font-bold ${totalNet >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-500 dark:text-orange-400"}`}>
                                {fmt(totalNet)}
                            </span>
                        </div>
                    </div>
                    {expanded
                        ? <ChevronDown className="h-5 w-5 text-gray-400" />
                        : <ChevronRight className="h-5 w-5 text-gray-400" />}
                </div>
            </button>

            {/* Expanded Detail Table */}
            {expanded && (
                <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
                                <th className="text-left px-4 py-2 font-medium text-gray-600 dark:text-gray-400 min-w-[200px] sticky left-0 bg-gray-50 dark:bg-[#0a0a0a] z-10">
                                    Line Item
                                </th>
                                {colHeaders.map(h => (
                                    <th key={h} className="text-right px-2 py-2 font-medium text-gray-600 dark:text-gray-400 min-w-[80px]">
                                        {h}
                                    </th>
                                ))}
                                <th className="text-right px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 min-w-[90px] border-l border-gray-200 dark:border-gray-600">
                                    Total
                                </th>
                                {showBudget && (
                                    <>
                                        <th className="text-right px-2 py-2 font-medium text-gray-500 dark:text-gray-400 min-w-[80px]">
                                            Budget
                                        </th>
                                        <th className="text-right px-2 py-2 font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">
                                            Var %
                                        </th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Revenue Section */}
                            <tr className="bg-green-50/50 dark:bg-green-900/10">
                                <td colSpan={colHeaders.length + 1 + (showBudget ? 2 : 0) + 1} className="px-4 py-1.5 font-semibold text-green-700 dark:text-green-400 text-[11px] uppercase tracking-wider">
                                    Revenue
                                </td>
                            </tr>
                            {dept.lines.filter(l => l.type === "revenue").map(line => (
                                <PnLRow
                                    key={line.code}
                                    line={line}
                                    showBudget={showBudget}
                                    viewMode={viewMode}
                                    currentMonth={currentMonth}
                                    getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                                />
                            ))}
                            {/* Revenue Subtotal */}
                            <SubtotalRow
                                label="Total Revenue"
                                actual={summary.revenue}
                                budget={summary.revenueBudget}
                                showBudget={showBudget}
                                viewMode={viewMode}
                                currentMonth={currentMonth}
                                className="text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/5"
                                getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                            />

                            {/* Empty spacer row */}
                            <tr><td colSpan={99} className="h-1" /></tr>

                            {/* Expense Section */}
                            <tr className="bg-red-50/50 dark:bg-red-900/10">
                                <td colSpan={colHeaders.length + 1 + (showBudget ? 2 : 0) + 1} className="px-4 py-1.5 font-semibold text-red-600 dark:text-red-400 text-[11px] uppercase tracking-wider">
                                    Expenses
                                </td>
                            </tr>
                            {dept.lines.filter(l => l.type === "expense").map(line => (
                                <PnLRow
                                    key={line.code}
                                    line={line}
                                    showBudget={showBudget}
                                    viewMode={viewMode}
                                    currentMonth={currentMonth}
                                    isExpense
                                    getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                                />
                            ))}
                            {/* Expense Subtotal */}
                            <SubtotalRow
                                label="Total Expenses"
                                actual={summary.expenses}
                                budget={summary.expensesBudget}
                                showBudget={showBudget}
                                viewMode={viewMode}
                                currentMonth={currentMonth}
                                className="text-red-600 dark:text-red-400 bg-red-50/30 dark:bg-red-900/5"
                                getQuarterlyFromMonthly={getQuarterlyFromMonthly}
                            />

                            {/* Net Result */}
                            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                                <td className="px-4 py-2 font-bold text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-black z-10">
                                    NET RESULT
                                </td>
                                {viewMode === "monthly" &&
                                    monthKeys.map((k, i) => (
                                        <td key={k} className={`text-right px-2 py-2 font-bold ${summary.net[k] >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                            {fmtFull(summary.net[k])}
                                        </td>
                                    ))}
                                {viewMode === "quarterly" &&
                                    getQuarterlyFromMonthly(summary.net).map((v, i) => (
                                        <td key={i} className={`text-right px-2 py-2 font-bold ${v >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                            {fmtFull(v)}
                                        </td>
                                    ))}
                                {viewMode === "ytd" && (
                                    <td className={`text-right px-2 py-2 font-bold ${getYTD(summary.net, currentMonth) >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                        {fmtFull(getYTD(summary.net, currentMonth))}
                                    </td>
                                )}
                                <td className={`text-right px-3 py-2 font-bold border-l border-gray-200 dark:border-gray-600 ${totalNet >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    {fmtFull(totalNet)}
                                </td>
                                {showBudget && (
                                    <>
                                        <td className={`text-right px-2 py-2 font-bold ${sumAll(summary.netBudget) >= 0 ? "text-green-700/70 dark:text-green-400/70" : "text-red-600/70 dark:text-red-400/70"}`}>
                                            {fmtFull(sumAll(summary.netBudget))}
                                        </td>
                                        <td className="text-right px-2 py-2">
                                            <VarianceBadge actual={totalNet} budget={sumAll(summary.netBudget)} />
                                        </td>
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </Card>
    );
}

// ── P&L Line Row ──────────────────────────────────────────────────────────

function PnLRow({
    line, showBudget, viewMode, currentMonth, isExpense, getQuarterlyFromMonthly,
}: {
    line: PnLLine; showBudget: boolean; viewMode: "monthly" | "quarterly" | "ytd";
    currentMonth: number; isExpense?: boolean;
    getQuarterlyFromMonthly: (m: MonthlyValues) => number[];
}) {
    const total = sumAll(line.actual);
    const budgetTotal = sumAll(line.budget);

    return (
        <tr className="hover:bg-gray-50 dark:hover:bg-[#111111]/30 transition-colors">
            <td className="px-4 py-1.5 text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-black z-10">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{line.code}</span>
                    <span>{line.name}</span>
                </div>
            </td>
            {viewMode === "monthly" &&
                monthKeys.map((k) => (
                    <td key={k} className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400 tabular-nums">
                        {fmtFull(line.actual[k])}
                    </td>
                ))}
            {viewMode === "quarterly" &&
                getQuarterlyFromMonthly(line.actual).map((v, i) => (
                    <td key={i} className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400 tabular-nums">
                        {fmtFull(v)}
                    </td>
                ))}
            {viewMode === "ytd" && (
                <td className="text-right px-2 py-1.5 text-gray-600 dark:text-gray-400 tabular-nums">
                    {fmtFull(getYTD(line.actual, currentMonth))}
                </td>
            )}
            <td className="text-right px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200 border-l border-gray-200 dark:border-gray-600 tabular-nums">
                {fmtFull(total)}
            </td>
            {showBudget && (
                <>
                    <td className="text-right px-2 py-1.5 text-gray-400 dark:text-gray-500 tabular-nums">
                        {fmtFull(budgetTotal)}
                    </td>
                    <td className="text-right px-2 py-1.5">
                        <VarianceBadge actual={total} budget={budgetTotal} invert={isExpense} />
                    </td>
                </>
            )}
        </tr>
    );
}

// ── Subtotal Row ──────────────────────────────────────────────────────────

function SubtotalRow({
    label, actual, budget, showBudget, viewMode, currentMonth, className, getQuarterlyFromMonthly,
}: {
    label: string; actual: MonthlyValues; budget: MonthlyValues; showBudget: boolean;
    viewMode: "monthly" | "quarterly" | "ytd"; currentMonth: number;
    className?: string;
    getQuarterlyFromMonthly: (m: MonthlyValues) => number[];
}) {
    const total = sumAll(actual);
    const budgetTotal = sumAll(budget);

    return (
        <tr className={`border-t border-gray-200 dark:border-gray-700 font-semibold ${className}`}>
            <td className="px-4 py-1.5 sticky left-0 bg-white dark:bg-black z-10">{label}</td>
            {viewMode === "monthly" &&
                monthKeys.map(k => (
                    <td key={k} className="text-right px-2 py-1.5 tabular-nums">{fmtFull(actual[k])}</td>
                ))}
            {viewMode === "quarterly" &&
                getQuarterlyFromMonthly(actual).map((v, i) => (
                    <td key={i} className="text-right px-2 py-1.5 tabular-nums">{fmtFull(v)}</td>
                ))}
            {viewMode === "ytd" && (
                <td className="text-right px-2 py-1.5 tabular-nums">{fmtFull(getYTD(actual, currentMonth))}</td>
            )}
            <td className="text-right px-3 py-1.5 border-l border-gray-200 dark:border-gray-600 tabular-nums">
                {fmtFull(total)}
            </td>
            {showBudget && (
                <>
                    <td className="text-right px-2 py-1.5 opacity-70 tabular-nums">{fmtFull(budgetTotal)}</td>
                    <td className="text-right px-2 py-1.5">
                        <VarianceBadge actual={total} budget={budgetTotal} />
                    </td>
                </>
            )}
        </tr>
    );
}

// ── Consolidated Row (bottom) ─────────────────────────────────────────────

function ConsolidatedRow({
    label, actual, budget, showBudget, viewMode, currentMonth, type, getQuarterlyFromMonthly,
}: {
    label: string; actual: MonthlyValues; budget: MonthlyValues; showBudget: boolean;
    viewMode: "monthly" | "quarterly" | "ytd"; currentMonth: number;
    type: "revenue" | "expense" | "total";
    getQuarterlyFromMonthly: (m: MonthlyValues) => number[];
}) {
    const total = sumAll(actual);
    const budgetTotal = sumAll(budget);
    const colorClass = type === "revenue"
        ? "text-green-700 dark:text-green-400"
        : type === "expense"
            ? "text-red-600 dark:text-red-400"
            : total >= 0
                ? "text-blue-600 dark:text-blue-400"
                : "text-orange-600 dark:text-orange-400";

    const colHeaders = viewMode === "monthly"
        ? MONTHS
        : viewMode === "quarterly"
            ? ["Q1", "Q2", "Q3", "Q4"]
            : ["YTD"];

    return (
        <div className="flex items-center text-xs py-1.5 overflow-x-auto">
            <div className={`min-w-[200px] px-4 font-bold ${colorClass}`}>{label}</div>
            <div className="flex-1 flex">
                {viewMode === "monthly" &&
                    monthKeys.map(k => (
                        <div key={k} className={`min-w-[80px] text-right px-2 font-semibold ${colorClass} tabular-nums`}>
                            {fmtFull(actual[k])}
                        </div>
                    ))}
                {viewMode === "quarterly" &&
                    getQuarterlyFromMonthly(actual).map((v, i) => (
                        <div key={i} className={`min-w-[80px] text-right px-2 font-semibold ${colorClass} tabular-nums`}>
                            {fmtFull(v)}
                        </div>
                    ))}
                {viewMode === "ytd" && (
                    <div className={`min-w-[80px] text-right px-2 font-semibold ${colorClass} tabular-nums`}>
                        {fmtFull(getYTD(actual, currentMonth))}
                    </div>
                )}
                <div className={`min-w-[90px] text-right px-3 font-bold ${colorClass} border-l border-gray-200 dark:border-gray-600 tabular-nums`}>
                    {fmtFull(total)}
                </div>
                {showBudget && (
                    <>
                        <div className={`min-w-[80px] text-right px-2 opacity-60 ${colorClass} tabular-nums`}>
                            {fmtFull(budgetTotal)}
                        </div>
                        <div className="min-w-[60px] text-right px-2">
                            <VarianceBadge actual={total} budget={budgetTotal} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Variance Badge ────────────────────────────────────────────────────────

function VarianceBadge({ actual, budget, invert }: { actual: number; budget: number; invert?: boolean }) {
    const variance = pct(actual, budget);
    if (Math.abs(variance) < 0.5) {
        return <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-end"><Minus className="h-3 w-3" /></span>;
    }
    const isGood = invert ? variance <= 0 : variance >= 0;
    return (
        <span className={`text-[10px] font-medium flex items-center justify-end gap-0.5 ${isGood ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
            {isGood ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(variance).toFixed(1)}%
        </span>
    );
}
