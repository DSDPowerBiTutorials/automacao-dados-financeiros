"use client";

import { useState, useEffect, useMemo } from "react";
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Download,
    Calendar,
    Building2,
    Layers,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    Filter,
    BarChart3,
    FileSpreadsheet,
    Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { formatCurrency } from "@/lib/formatters";

// Nomes dos meses
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface MonthlyData {
    jan: number; feb: number; mar: number; apr: number; may: number; jun: number;
    jul: number; aug: number; sep: number; oct: number; nov: number; dec: number;
}

interface DRELineMonthly {
    code: string;
    name: string;
    type: "revenue" | "expense" | "subtotal" | "total";
    level: number;
    monthly: MonthlyData;
    budget: MonthlyData;
    children?: DRELineMonthly[];
}

// Helper: criar dados mensais vazios
const emptyMonthlyData = (): MonthlyData => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
});

// Helper: gerar dados mensais simulados (para despesas ainda não integradas)
const generateMonthlyData = (baseAnnual: number, variance: number = 0.15): MonthlyData => {
    const monthlyBase = baseAnnual / 12;
    const seasonality = [0.85, 0.88, 0.95, 1.02, 1.08, 1.12, 0.92, 0.88, 1.05, 1.15, 1.18, 0.92];
    return {
        jan: Math.round(monthlyBase * seasonality[0] * (1 + (Math.random() - 0.5) * variance)),
        feb: Math.round(monthlyBase * seasonality[1] * (1 + (Math.random() - 0.5) * variance)),
        mar: Math.round(monthlyBase * seasonality[2] * (1 + (Math.random() - 0.5) * variance)),
        apr: Math.round(monthlyBase * seasonality[3] * (1 + (Math.random() - 0.5) * variance)),
        may: Math.round(monthlyBase * seasonality[4] * (1 + (Math.random() - 0.5) * variance)),
        jun: Math.round(monthlyBase * seasonality[5] * (1 + (Math.random() - 0.5) * variance)),
        jul: Math.round(monthlyBase * seasonality[6] * (1 + (Math.random() - 0.5) * variance)),
        aug: Math.round(monthlyBase * seasonality[7] * (1 + (Math.random() - 0.5) * variance)),
        sep: Math.round(monthlyBase * seasonality[8] * (1 + (Math.random() - 0.5) * variance)),
        oct: Math.round(monthlyBase * seasonality[9] * (1 + (Math.random() - 0.5) * variance)),
        nov: Math.round(monthlyBase * seasonality[10] * (1 + (Math.random() - 0.5) * variance)),
        dec: Math.round(monthlyBase * seasonality[11] * (1 + (Math.random() - 0.5) * variance)),
    };
};

const generateBudgetData = (baseAnnual: number): MonthlyData => {
    const monthlyBase = baseAnnual / 12;
    return {
        jan: Math.round(monthlyBase), feb: Math.round(monthlyBase), mar: Math.round(monthlyBase),
        apr: Math.round(monthlyBase), may: Math.round(monthlyBase), jun: Math.round(monthlyBase),
        jul: Math.round(monthlyBase), aug: Math.round(monthlyBase), sep: Math.round(monthlyBase),
        oct: Math.round(monthlyBase), nov: Math.round(monthlyBase), dec: Math.round(monthlyBase),
    };
};

const sumMonthly = (data: MonthlyData): number => {
    return data.jan + data.feb + data.mar + data.apr + data.may + data.jun +
        data.jul + data.aug + data.sep + data.oct + data.nov + data.dec;
};

const getMonthValue = (data: MonthlyData, month: number): number => {
    const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
    return data[keys[month]];
};

const getYTD = (data: MonthlyData, upToMonth: number): number => {
    const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
    return keys.slice(0, upToMonth + 1).reduce((sum, key) => sum + data[key], 0);
};

export default function PnLReport() {
    const { selectedScope } = useGlobalScope();
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["100.0", "101.0", "102.0", "103.0", "104.0", "105.0", "201.0", "202.0"])
    );
    const [selectedYear, setSelectedYear] = useState(2026);
    const [viewMode, setViewMode] = useState<"monthly" | "quarterly" | "annual">("monthly");
    const currentMonth = new Date().getMonth(); // 0-11

    // Estado para dados reais de receita
    const [webInvoicesRevenue, setWebInvoicesRevenue] = useState<MonthlyData>(emptyMonthlyData());
    const [totalRevenue, setTotalRevenue] = useState<MonthlyData>(emptyMonthlyData());
    const [byFinancialAccount, setByFinancialAccount] = useState<{ [key: string]: MonthlyData }>({});
    const [invoiceCount, setInvoiceCount] = useState<{ [key: string]: number }>({});

    // Buscar dados reais via API
    useEffect(() => {
        async function fetchRevenueData() {
            try {
                setLoading(true);

                // Buscar dados via API route (usa supabaseAdmin)
                const response = await fetch(`/api/pnl/revenue?year=${selectedYear}`);
                const result = await response.json();

                if (!response.ok || !result.success) {
                    console.error('Erro ao buscar dados:', result.error);
                    return;
                }

                setWebInvoicesRevenue(result.webInvoices?.revenue || emptyMonthlyData());
                setTotalRevenue(result.totalRevenue || emptyMonthlyData());
                setByFinancialAccount(result.byFinancialAccount || {});
                setInvoiceCount(result.webInvoices?.count || {});
                console.log('📊 Receita carregada:', result);

            } catch (err) {
                console.error('Erro ao carregar receita:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchRevenueData();
    }, [selectedYear]);

    // Helper para pegar dados da financial account ou zeros
    const getFA = (code: string): MonthlyData => byFinancialAccount[code] || emptyMonthlyData();

    // Revenue structure with REAL data from Financial Accounts
    const revenueStructure: DRELineMonthly[] = useMemo(() => [
        {
            code: "100.0", name: "Web Invoices (HubSpot)", type: "revenue", level: 0,
            monthly: webInvoicesRevenue, budget: generateBudgetData(1200000),
            children: [
                { code: "100.1", name: "Web Orders", type: "revenue", level: 1, monthly: webInvoicesRevenue, budget: generateBudgetData(1200000) },
            ],
        },
        {
            code: "101.0", name: "Growth (Education)", type: "revenue", level: 0,
            // Soma das contas 101.x
            monthly: {
                jan: getFA("101.1").jan + getFA("101.3").jan,
                feb: getFA("101.1").feb + getFA("101.3").feb,
                mar: getFA("101.1").mar + getFA("101.3").mar,
                apr: getFA("101.1").apr + getFA("101.3").apr,
                may: getFA("101.1").may + getFA("101.3").may,
                jun: getFA("101.1").jun + getFA("101.3").jun,
                jul: getFA("101.1").jul + getFA("101.3").jul,
                aug: getFA("101.1").aug + getFA("101.3").aug,
                sep: getFA("101.1").sep + getFA("101.3").sep,
                oct: getFA("101.1").oct + getFA("101.3").oct,
                nov: getFA("101.1").nov + getFA("101.3").nov,
                dec: getFA("101.1").dec + getFA("101.3").dec,
            }, budget: generateBudgetData(850000),
            children: [
                { code: "101.1", name: "DSD Courses", type: "revenue", level: 1, monthly: getFA("101.1"), budget: generateBudgetData(350000) },
                { code: "101.3", name: "Mastership", type: "revenue", level: 1, monthly: getFA("101.3"), budget: generateBudgetData(180000) },
                { code: "101.4", name: "PC Membership", type: "revenue", level: 1, monthly: getFA("101.4"), budget: generateBudgetData(100000) },
                { code: "101.5", name: "Partnerships", type: "revenue", level: 1, monthly: getFA("101.5"), budget: generateBudgetData(80000) },
            ],
        },
        {
            code: "102.0", name: "Delight (Clinic Services)", type: "revenue", level: 0,
            monthly: {
                jan: getFA("102.5").jan + getFA("102.6").jan,
                feb: getFA("102.5").feb + getFA("102.6").feb,
                mar: getFA("102.5").mar + getFA("102.6").mar,
                apr: getFA("102.5").apr + getFA("102.6").apr,
                may: getFA("102.5").may + getFA("102.6").may,
                jun: getFA("102.5").jun + getFA("102.6").jun,
                jul: getFA("102.5").jul + getFA("102.6").jul,
                aug: getFA("102.5").aug + getFA("102.6").aug,
                sep: getFA("102.5").sep + getFA("102.6").sep,
                oct: getFA("102.5").oct + getFA("102.6").oct,
                nov: getFA("102.5").nov + getFA("102.6").nov,
                dec: getFA("102.5").dec + getFA("102.6").dec,
            }, budget: generateBudgetData(1200000),
            children: [
                { code: "102.5", name: "Consultancies", type: "revenue", level: 1, monthly: getFA("102.5"), budget: generateBudgetData(95000) },
                { code: "102.6", name: "Marketing Coaching", type: "revenue", level: 1, monthly: getFA("102.6"), budget: generateBudgetData(45000) },
            ],
        },
        {
            code: "103.0", name: "Planning Center", type: "revenue", level: 0,
            monthly: getFA("103.0"), budget: generateBudgetData(680000),
            children: [],
        },
        {
            code: "104.0", name: "LAB (Manufacture)", type: "revenue", level: 0,
            monthly: getFA("104.0"), budget: generateBudgetData(520000),
            children: [],
        },
        {
            code: "105.0", name: "Other Income", type: "revenue", level: 0,
            monthly: {
                jan: getFA("105.1").jan + getFA("105.4").jan,
                feb: getFA("105.1").feb + getFA("105.4").feb,
                mar: getFA("105.1").mar + getFA("105.4").mar,
                apr: getFA("105.1").apr + getFA("105.4").apr,
                may: getFA("105.1").may + getFA("105.4").may,
                jun: getFA("105.1").jun + getFA("105.4").jun,
                jul: getFA("105.1").jul + getFA("105.4").jul,
                aug: getFA("105.1").aug + getFA("105.4").aug,
                sep: getFA("105.1").sep + getFA("105.4").sep,
                oct: getFA("105.1").oct + getFA("105.4").oct,
                nov: getFA("105.1").nov + getFA("105.4").nov,
                dec: getFA("105.1").dec + getFA("105.4").dec,
            }, budget: generateBudgetData(150000),
            children: [
                { code: "105.1", name: "Level 1 Subscriptions", type: "revenue", level: 1, monthly: getFA("105.1"), budget: generateBudgetData(80000) },
                { code: "105.4", name: "Other Marketing", type: "revenue", level: 1, monthly: getFA("105.4"), budget: generateBudgetData(10000) },
            ],
        },
    ], [webInvoicesRevenue, byFinancialAccount]);

    // Expense structure with monthly data
    const expenseStructure: DRELineMonthly[] = useMemo(() => [
        {
            code: "201.0", name: "Cost of Goods Sold (COGS)", type: "expense", level: 0,
            monthly: generateMonthlyData(695000), budget: generateBudgetData(680000),
            children: [
                { code: "201.1", name: "COGS Growth", type: "expense", level: 1, monthly: generateMonthlyData(185000), budget: generateBudgetData(180000) },
                { code: "201.2", name: "COGS Delight", type: "expense", level: 1, monthly: generateMonthlyData(228000), budget: generateBudgetData(220000) },
                { code: "201.3", name: "COGS Planning Center", type: "expense", level: 1, monthly: generateMonthlyData(152000), budget: generateBudgetData(150000) },
                { code: "201.4", name: "COGS LAB", type: "expense", level: 1, monthly: generateMonthlyData(130000), budget: generateBudgetData(130000) },
            ],
        },
        {
            code: "202.0", name: "Labour", type: "expense", level: 0,
            monthly: generateMonthlyData(1420000), budget: generateBudgetData(1450000),
            children: [
                { code: "202.1", name: "Labour Growth", type: "expense", level: 1, monthly: generateMonthlyData(275000), budget: generateBudgetData(280000) },
                { code: "202.2", name: "Labour Marketing", type: "expense", level: 1, monthly: generateMonthlyData(175000), budget: generateBudgetData(180000) },
                { code: "202.3", name: "Labour Planning Center", type: "expense", level: 1, monthly: generateMonthlyData(315000), budget: generateBudgetData(320000) },
                { code: "202.4", name: "Labour LAB", type: "expense", level: 1, monthly: generateMonthlyData(272000), budget: generateBudgetData(280000) },
                { code: "202.5", name: "Labour Corporate", type: "expense", level: 1, monthly: generateMonthlyData(248000), budget: generateBudgetData(250000) },
                { code: "202.6", name: "Labour Delight ROW", type: "expense", level: 1, monthly: generateMonthlyData(78000), budget: generateBudgetData(80000) },
                { code: "202.7", name: "Labour AMEX", type: "expense", level: 1, monthly: generateMonthlyData(38000), budget: generateBudgetData(40000) },
                { code: "202.8", name: "Social Security", type: "expense", level: 1, monthly: generateMonthlyData(19000), budget: generateBudgetData(20000) },
            ],
        },
        {
            code: "203.0", name: "Travels and Meals", type: "expense", level: 0,
            monthly: generateMonthlyData(172000), budget: generateBudgetData(180000),
            children: [
                { code: "203.1", name: "T&M Growth", type: "expense", level: 1, monthly: generateMonthlyData(42000), budget: generateBudgetData(45000) },
                { code: "203.2", name: "T&M Marketing", type: "expense", level: 1, monthly: generateMonthlyData(33000), budget: generateBudgetData(35000) },
                { code: "203.5", name: "T&M Corporate", type: "expense", level: 1, monthly: generateMonthlyData(44000), budget: generateBudgetData(45000) },
            ],
        },
        { code: "204.0", name: "Professional Fees", type: "expense", level: 0, monthly: generateMonthlyData(118000), budget: generateBudgetData(120000), children: [] },
        { code: "205.0", name: "Marketing and Advertising", type: "expense", level: 0, monthly: generateMonthlyData(92000), budget: generateBudgetData(95000), children: [] },
        { code: "206.0", name: "Office", type: "expense", level: 0, monthly: generateMonthlyData(82000), budget: generateBudgetData(85000), children: [] },
        { code: "207.0", name: "Information Technology", type: "expense", level: 0, monthly: generateMonthlyData(78000), budget: generateBudgetData(75000), children: [] },
        { code: "208.0", name: "Research and Development", type: "expense", level: 0, monthly: generateMonthlyData(42000), budget: generateBudgetData(45000), children: [] },
        { code: "209.0", name: "Bank and Financial Fees", type: "expense", level: 0, monthly: generateMonthlyData(38000), budget: generateBudgetData(35000), children: [] },
        { code: "210.0", name: "Miscellaneous", type: "expense", level: 0, monthly: generateMonthlyData(23000), budget: generateBudgetData(25000), children: [] },
        { code: "211.0", name: "Amortization & Depreciation", type: "expense", level: 0, monthly: generateMonthlyData(40000), budget: generateBudgetData(40000), children: [] },
        { code: "300.0", name: "FX Variation", type: "expense", level: 0, monthly: generateMonthlyData(-15000, 0.5), budget: generateBudgetData(0), children: [] },
    ], []);

    // Calculate monthly totals
    const monthlyTotals = useMemo(() => {
        const calcMonthlySum = (items: DRELineMonthly[], monthIndex: number) =>
            items.reduce((sum, item) => sum + getMonthValue(item.monthly, monthIndex), 0);
        const calcBudgetSum = (items: DRELineMonthly[], monthIndex: number) =>
            items.reduce((sum, item) => sum + getMonthValue(item.budget, monthIndex), 0);

        const cogs = expenseStructure.find(e => e.code === "201.0");
        const opexItems = expenseStructure.filter(e => e.code !== "201.0" && e.code !== "211.0");
        const amortization = expenseStructure.find(e => e.code === "211.0");

        const months = MONTHS.map((_, i) => {
            const revenue = calcMonthlySum(revenueStructure, i);
            const revenueBudget = calcBudgetSum(revenueStructure, i);
            const cogsVal = cogs ? getMonthValue(cogs.monthly, i) : 0;
            const cogsBudget = cogs ? getMonthValue(cogs.budget, i) : 0;
            const grossProfit = revenue - cogsVal;
            const grossProfitBudget = revenueBudget - cogsBudget;
            const opex = opexItems.reduce((sum, item) => sum + getMonthValue(item.monthly, i), 0);
            const opexBudget = opexItems.reduce((sum, item) => sum + getMonthValue(item.budget, i), 0);
            const ebitda = grossProfit - opex;
            const ebitdaBudget = grossProfitBudget - opexBudget;
            const totalExpenses = calcMonthlySum(expenseStructure, i);
            const totalExpensesBudget = calcBudgetSum(expenseStructure, i);
            const netIncome = revenue - totalExpenses;
            const netIncomeBudget = revenueBudget - totalExpensesBudget;

            return {
                revenue, revenueBudget,
                cogs: cogsVal, cogsBudget,
                grossProfit, grossProfitBudget,
                opex, opexBudget,
                ebitda, ebitdaBudget,
                totalExpenses, totalExpensesBudget,
                netIncome, netIncomeBudget,
            };
        });

        // Calculate YTD
        const ytd = {
            revenue: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.revenue, 0),
            revenueBudget: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.revenueBudget, 0),
            grossProfit: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.grossProfit, 0),
            grossProfitBudget: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.grossProfitBudget, 0),
            ebitda: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.ebitda, 0),
            ebitdaBudget: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.ebitdaBudget, 0),
            totalExpenses: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.totalExpenses, 0),
            totalExpensesBudget: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.totalExpensesBudget, 0),
            netIncome: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.netIncome, 0),
            netIncomeBudget: months.slice(0, currentMonth + 1).reduce((s, m) => s + m.netIncomeBudget, 0),
        };

        // Full year totals
        const annual = {
            revenue: months.reduce((s, m) => s + m.revenue, 0),
            revenueBudget: months.reduce((s, m) => s + m.revenueBudget, 0),
            grossProfit: months.reduce((s, m) => s + m.grossProfit, 0),
            grossProfitBudget: months.reduce((s, m) => s + m.grossProfitBudget, 0),
            ebitda: months.reduce((s, m) => s + m.ebitda, 0),
            ebitdaBudget: months.reduce((s, m) => s + m.ebitdaBudget, 0),
            totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
            totalExpensesBudget: months.reduce((s, m) => s + m.totalExpensesBudget, 0),
            netIncome: months.reduce((s, m) => s + m.netIncome, 0),
            netIncomeBudget: months.reduce((s, m) => s + m.netIncomeBudget, 0),
        };

        return { months, ytd, annual };
    }, [revenueStructure, expenseStructure, currentMonth]);

    const toggleSection = (code: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(code)) {
            newExpanded.delete(code);
        } else {
            newExpanded.add(code);
        }
        setExpandedSections(newExpanded);
    };

    // Formato completo sem abreviação: 100.000
    const formatNumber = (value: number): string => {
        return Math.round(value).toLocaleString('pt-PT');
    };

    // Formato compacto para células da tabela (sem abreviação)
    const formatCompact = (value: number): string => {
        return Math.round(value).toLocaleString('pt-PT');
    };

    // Render monthly P&L row
    const renderMonthlyRow = (line: DRELineMonthly, isChild = false) => {
        const hasChildren = line.children && line.children.length > 0;
        const isExpanded = expandedSections.has(line.code);
        const monthlyValues = MONTHS.map((_, i) => getMonthValue(line.monthly, i));
        const total = sumMonthly(line.monthly);
        const ytd = getYTD(line.monthly, currentMonth);

        return (
            <div key={line.code}>
                <div className={`grid grid-cols-[200px_repeat(12,minmax(70px,1fr))_80px_80px] gap-1 py-2 px-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${isChild ? "pl-8 bg-gray-900/30" : "bg-gray-900/60"}`}>
                    {/* Account name */}
                    <div className="flex items-center gap-1 min-w-0">
                        {hasChildren ? (
                            <button onClick={() => toggleSection(line.code)} className="p-0.5 hover:bg-gray-700 rounded shrink-0">
                                {isExpanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
                            </button>
                        ) : (
                            <div className="w-4" />
                        )}
                        <span className="text-[10px] text-gray-500 font-mono shrink-0">{line.code}</span>
                        <span className={`text-xs truncate ${isChild ? "text-gray-400" : "font-medium text-white"}`} title={line.name}>{line.name}</span>
                    </div>

                    {/* Monthly values */}
                    {monthlyValues.map((val, i) => (
                        <div key={i} className={`text-right ${i > currentMonth ? "opacity-40" : ""}`}>
                            <span className={`text-xs font-mono ${line.type === "revenue" ? "text-emerald-400" : "text-red-400"}`}>
                                {formatCompact(val)}
                            </span>
                        </div>
                    ))}

                    {/* YTD */}
                    <div className="text-right bg-blue-900/20 px-1 rounded">
                        <span className={`text-xs font-mono font-semibold ${line.type === "revenue" ? "text-emerald-300" : "text-red-300"}`}>
                            {formatCompact(ytd)}
                        </span>
                    </div>

                    {/* Total */}
                    <div className="text-right bg-gray-800/50 px-1 rounded">
                        <span className={`text-xs font-mono font-bold ${line.type === "revenue" ? "text-emerald-300" : "text-red-300"}`}>
                            {formatCompact(total)}
                        </span>
                    </div>
                </div>
                {hasChildren && isExpanded && line.children?.map((child) => renderMonthlyRow(child, true))}
            </div>
        );
    };

    // Subtotal row for monthly view
    const renderMonthlySubtotal = (label: string, monthlyData: typeof monthlyTotals.months, field: keyof typeof monthlyTotals.months[0], ytd: number, total: number, isProfit = false) => {
        return (
            <div className={`grid grid-cols-[200px_repeat(12,minmax(70px,1fr))_80px_80px] gap-1 py-3 px-3 ${isProfit ? "bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-y border-blue-500/30" : "bg-gray-800/60 border-y border-gray-700"}`}>
                <div className="flex items-center gap-2">
                    <div className="w-4" />
                    <span className={`font-semibold ${isProfit ? "text-blue-300" : "text-white"} text-sm`}>{label}</span>
                </div>
                {monthlyData.map((m, i) => (
                    <div key={i} className={`text-right ${i > currentMonth ? "opacity-40" : ""}`}>
                        <span className={`text-xs font-mono font-semibold ${isProfit ? "text-blue-300" : "text-gray-200"}`}>
                            {formatCompact(m[field] as number)}
                        </span>
                    </div>
                ))}
                <div className="text-right bg-blue-900/30 px-1 rounded">
                    <span className={`text-xs font-mono font-bold ${isProfit ? "text-blue-200" : "text-gray-100"}`}>{formatCompact(ytd)}</span>
                </div>
                <div className="text-right bg-amber-900/30 px-1 rounded">
                    <span className={`text-xs font-mono font-bold ${isProfit ? "text-amber-200" : "text-gray-100"}`}>{formatCompact(total)}</span>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-16 bg-gray-800 rounded-lg"></div>
                    <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-gray-800 rounded-lg"></div>)}</div>
                    <div className="h-96 bg-gray-800 rounded-lg"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Premium Dark Header */}
            <header className="bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800 border-b border-gray-800 px-6 py-5 sticky top-0 z-20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 rounded-xl border border-emerald-500/30">
                            <BarChart3 className="h-7 w-7 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                P&L Statement
                            </h1>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Demonstração do Resultado • {selectedYear} • {selectedScope === "GLOBAL" ? "All Regions" : selectedScope}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-gray-800/60 rounded-lg p-1 border border-gray-700">
                            {[2024, 2025, 2026].map((year) => (
                                <button
                                    key={year}
                                    onClick={() => setSelectedYear(year)}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-all ${selectedYear === year ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-white hover:bg-gray-700"}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                            <RefreshCw className="h-4 w-4 mr-2" />Sync
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                            <FileSpreadsheet className="h-4 w-4 mr-2" />Excel
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Download className="h-4 w-4 mr-2" />Export PDF
                        </Button>
                    </div>
                </div>
            </header>

            <div className="p-6 space-y-6">
                {/* Executive Summary KPIs */}
                <div className="grid grid-cols-6 gap-4">
                    {/* Revenue Card */}
                    <Card className="bg-gradient-to-br from-emerald-900/50 to-emerald-950/80 border-emerald-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Revenue YTD</span>
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.revenue)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    {((monthlyTotals.ytd.revenue / monthlyTotals.ytd.revenueBudget - 1) * 100).toFixed(1)}% vs Budget
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-emerald-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-emerald-400/70">Full Year</span>
                                    <span className="text-emerald-300 font-semibold">{formatCompact(monthlyTotals.annual.revenue)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Gross Profit Card */}
                    <Card className="bg-gradient-to-br from-blue-900/50 to-blue-950/80 border-blue-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Gross Profit</span>
                                <Layers className="h-4 w-4 text-blue-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.grossProfit)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/30">
                                    {((monthlyTotals.ytd.grossProfit / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Margin
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-blue-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-blue-400/70">Full Year</span>
                                    <span className="text-blue-300 font-semibold">{formatCompact(monthlyTotals.annual.grossProfit)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* EBITDA Card */}
                    <Card className="bg-gradient-to-br from-purple-900/50 to-purple-950/80 border-purple-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">EBITDA</span>
                                <Building2 className="h-4 w-4 text-purple-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.ebitda)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/30">
                                    {((monthlyTotals.ytd.ebitda / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Margin
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-purple-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-purple-400/70">Full Year</span>
                                    <span className="text-purple-300 font-semibold">{formatCompact(monthlyTotals.annual.ebitda)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Expenses Card */}
                    <Card className="bg-gradient-to-br from-red-900/50 to-red-950/80 border-red-700/50 col-span-1">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Expenses</span>
                                <TrendingDown className="h-4 w-4 text-red-400" />
                            </div>
                            <p className="text-2xl font-bold text-white mb-1">{formatCompact(monthlyTotals.ytd.totalExpenses)}</p>
                            <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30">
                                    {((1 - monthlyTotals.ytd.totalExpenses / monthlyTotals.ytd.totalExpensesBudget) * 100).toFixed(1)}% Under
                                </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t border-red-800/50">
                                <div className="flex justify-between text-xs">
                                    <span className="text-red-400/70">Full Year</span>
                                    <span className="text-red-300 font-semibold">{formatCompact(monthlyTotals.annual.totalExpenses)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Net Income Card */}
                    <Card className="bg-gradient-to-br from-amber-900/50 to-amber-950/80 border-amber-700/50 col-span-2">
                        <CardContent className="pt-5 pb-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Net Income YTD</span>
                                <DollarSign className="h-4 w-4 text-amber-400" />
                            </div>
                            <div className="flex items-baseline gap-4">
                                <p className="text-3xl font-bold text-white">{formatCurrency(monthlyTotals.ytd.netIncome, "EUR")}</p>
                                <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">
                                    {((monthlyTotals.ytd.netIncome / monthlyTotals.ytd.revenue) * 100).toFixed(1)}% Net Margin
                                </Badge>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4 pt-3 border-t border-amber-800/50">
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">vs Budget</span>
                                    <p className={`text-sm font-semibold ${monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "text-emerald-400" : "text-red-400"}`}>
                                        {monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "+" : ""}{formatCompact(monthlyTotals.ytd.netIncome - monthlyTotals.ytd.netIncomeBudget)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">Full Year Est.</span>
                                    <p className="text-sm font-semibold text-amber-300">{formatCompact(monthlyTotals.annual.netIncome)}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-amber-400/70 uppercase">Variance %</span>
                                    <p className={`text-sm font-semibold ${monthlyTotals.ytd.netIncome >= monthlyTotals.ytd.netIncomeBudget ? "text-emerald-400" : "text-red-400"}`}>
                                        {((monthlyTotals.ytd.netIncome / monthlyTotals.ytd.netIncomeBudget - 1) * 100).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly P&L Table */}
                <Card className="bg-gray-900 border-gray-800 overflow-hidden">
                    <CardHeader className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800/80 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-gray-400" />
                                    Monthly Income Statement
                                </CardTitle>
                                <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                    {MONTHS_FULL[currentMonth]} {selectedYear}
                                </Badge>
                                <Badge className="text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                    📊 Web Invoices: Dados Reais
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-emerald-500/50 rounded"></div>
                                    <span>Revenue</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-red-500/50 rounded"></div>
                                    <span>Expense</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-blue-500/50 rounded"></div>
                                    <span>YTD</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-amber-500/50 rounded"></div>
                                    <span>Total</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    {/* Table Header */}
                    <div className="grid grid-cols-[200px_repeat(12,minmax(70px,1fr))_80px_80px] gap-1 py-2 px-3 bg-gray-800/80 border-b border-gray-700 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sticky top-[73px] z-10">
                        <div>Account</div>
                        {MONTHS.map((m, i) => (
                            <div key={m} className={`text-right ${i === currentMonth ? "text-emerald-400" : ""} ${i > currentMonth ? "opacity-50" : ""}`}>
                                {m}
                            </div>
                        ))}
                        <div className="text-right text-blue-400 bg-blue-900/20 px-1 rounded">YTD</div>
                        <div className="text-right text-amber-400 bg-amber-900/20 px-1 rounded">Total</div>
                    </div>

                    {/* Revenue Section */}
                    <div className="bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 border-b border-emerald-800/50 py-2 px-3">
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-3 w-3" />
                            Revenue
                        </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {revenueStructure.map((line) => renderMonthlyRow(line))}
                    </div>
                    {renderMonthlySubtotal("TOTAL REVENUE", monthlyTotals.months, "revenue", monthlyTotals.ytd.revenue, monthlyTotals.annual.revenue)}

                    {/* Expenses Section */}
                    <div className="bg-gradient-to-r from-red-900/40 to-red-900/20 border-b border-red-800/50 py-2 px-3 mt-1">
                        <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                            <TrendingDown className="h-3 w-3" />
                            Expenses
                        </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                        {expenseStructure.map((line) => renderMonthlyRow(line))}
                    </div>
                    {renderMonthlySubtotal("TOTAL EXPENSES", monthlyTotals.months, "totalExpenses", monthlyTotals.ytd.totalExpenses, monthlyTotals.annual.totalExpenses)}

                    {/* Profit Lines */}
                    {renderMonthlySubtotal("GROSS PROFIT", monthlyTotals.months, "grossProfit", monthlyTotals.ytd.grossProfit, monthlyTotals.annual.grossProfit, true)}
                    {renderMonthlySubtotal("EBITDA", monthlyTotals.months, "ebitda", monthlyTotals.ytd.ebitda, monthlyTotals.annual.ebitda, true)}

                    {/* Net Income Final Row */}
                    <div className="bg-gradient-to-r from-amber-900/60 via-orange-900/50 to-amber-900/60 border-y-2 border-amber-500/50 py-4 px-3">
                        <div className="grid grid-cols-[200px_repeat(12,minmax(70px,1fr))_80px_80px] gap-1">
                            <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-amber-400" />
                                <span className="text-lg font-bold text-amber-300">NET INCOME</span>
                            </div>
                            {monthlyTotals.months.map((m, i) => (
                                <div key={i} className={`text-right ${i > currentMonth ? "opacity-40" : ""}`}>
                                    <span className={`text-sm font-mono font-bold ${m.netIncome >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                                        {formatCompact(m.netIncome)}
                                    </span>
                                </div>
                            ))}
                            <div className="text-right bg-blue-900/40 px-2 rounded-lg py-1">
                                <span className={`text-sm font-mono font-bold ${monthlyTotals.ytd.netIncome >= 0 ? "text-blue-200" : "text-red-300"}`}>
                                    {formatCompact(monthlyTotals.ytd.netIncome)}
                                </span>
                            </div>
                            <div className="text-right bg-amber-900/40 px-2 rounded-lg py-1">
                                <span className={`text-sm font-mono font-bold ${monthlyTotals.annual.netIncome >= 0 ? "text-amber-200" : "text-red-300"}`}>
                                    {formatCompact(monthlyTotals.annual.netIncome)}
                                </span>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Budget vs Actual Comparison */}
                <Card className="bg-gray-900 border-gray-800">
                    <CardHeader className="border-b border-gray-800 py-4">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Filter className="h-4 w-4 text-gray-400" />
                            Budget vs Actual Variance Analysis
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-5 gap-4">
                            {[
                                { label: "Revenue", ytdActual: monthlyTotals.ytd.revenue, ytdBudget: monthlyTotals.ytd.revenueBudget, color: "emerald" },
                                { label: "Gross Profit", ytdActual: monthlyTotals.ytd.grossProfit, ytdBudget: monthlyTotals.ytd.grossProfitBudget, color: "blue" },
                                { label: "EBITDA", ytdActual: monthlyTotals.ytd.ebitda, ytdBudget: monthlyTotals.ytd.ebitdaBudget, color: "purple" },
                                { label: "Expenses", ytdActual: monthlyTotals.ytd.totalExpenses, ytdBudget: monthlyTotals.ytd.totalExpensesBudget, color: "red", invertVariance: true },
                                { label: "Net Income", ytdActual: monthlyTotals.ytd.netIncome, ytdBudget: monthlyTotals.ytd.netIncomeBudget, color: "amber" },
                            ].map((item) => {
                                const variance = item.ytdActual - item.ytdBudget;
                                const variancePercent = item.ytdBudget !== 0 ? (variance / item.ytdBudget) * 100 : 0;
                                const isPositive = item.invertVariance ? variance <= 0 : variance >= 0;

                                return (
                                    <div key={item.label} className={`bg-${item.color}-900/20 border border-${item.color}-800/40 rounded-lg p-4`}>
                                        <div className="text-xs font-semibold text-gray-400 mb-3">{item.label}</div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Budget</span>
                                                <span className="text-gray-300 font-mono">{formatCompact(item.ytdBudget)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Actual</span>
                                                <span className="text-white font-mono font-semibold">{formatCompact(item.ytdActual)}</span>
                                            </div>
                                            <div className="border-t border-gray-700 pt-2 mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Variance</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-mono font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                                                            {variance >= 0 ? "+" : ""}{formatCompact(variance)}
                                                        </span>
                                                        <Badge className={`text-[10px] ${isPositive ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                                            {variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(1)}%
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
