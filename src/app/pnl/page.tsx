"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { formatCurrency } from "@/lib/formatters";

interface DRELine {
  code: string;
  name: string;
  type: "revenue" | "expense" | "subtotal" | "total";
  level: number;
  budget: number;
  actual: number;
  variance: number;
  variancePercent: number;
  children?: DRELine[];
}

export default function PnLReport() {
  const { selectedScope } = useGlobalScope();
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["101.0", "102.0", "103.0", "104.0", "105.0", "201.0", "202.0"])
  );

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Revenue structure based on chart of accounts
  const revenueStructure: DRELine[] = [
    {
      code: "101.0", name: "Growth (Education)", type: "revenue", level: 0,
      budget: 850000, actual: 892000, variance: 42000, variancePercent: 4.9,
      children: [
        { code: "101.1", name: "DSD Courses", type: "revenue", level: 1, budget: 350000, actual: 378000, variance: 28000, variancePercent: 8.0 },
        { code: "101.2", name: "Others Courses", type: "revenue", level: 1, budget: 120000, actual: 115000, variance: -5000, variancePercent: -4.2 },
        { code: "101.3", name: "Mastership", type: "revenue", level: 1, budget: 180000, actual: 195000, variance: 15000, variancePercent: 8.3 },
        { code: "101.4", name: "PC Membership", type: "revenue", level: 1, budget: 100000, actual: 104000, variance: 4000, variancePercent: 4.0 },
        { code: "101.5", name: "Partnerships", type: "revenue", level: 1, budget: 80000, actual: 78000, variance: -2000, variancePercent: -2.5 },
        { code: "101.6", name: "Level 2 Allocation", type: "revenue", level: 1, budget: 20000, actual: 22000, variance: 2000, variancePercent: 10.0 },
      ],
    },
    {
      code: "102.0", name: "Delight (Clinic Services)", type: "revenue", level: 0,
      budget: 1200000, actual: 1285000, variance: 85000, variancePercent: 7.1,
      children: [
        { code: "102.1", name: "Contracted ROW", type: "revenue", level: 1, budget: 450000, actual: 478000, variance: 28000, variancePercent: 6.2 },
        { code: "102.2", name: "Contracted AMEX", type: "revenue", level: 1, budget: 280000, actual: 295000, variance: 15000, variancePercent: 5.4 },
        { code: "102.3", name: "Level 3 New ROW", type: "revenue", level: 1, budget: 180000, actual: 192000, variance: 12000, variancePercent: 6.7 },
        { code: "102.4", name: "Level 3 New AMEX", type: "revenue", level: 1, budget: 120000, actual: 130000, variance: 10000, variancePercent: 8.3 },
        { code: "102.5", name: "Consultancies", type: "revenue", level: 1, budget: 95000, actual: 105000, variance: 10000, variancePercent: 10.5 },
        { code: "102.6", name: "Marketing Coaching", type: "revenue", level: 1, budget: 45000, actual: 52000, variance: 7000, variancePercent: 15.6 },
        { code: "102.7", name: "Others", type: "revenue", level: 1, budget: 30000, actual: 33000, variance: 3000, variancePercent: 10.0 },
      ],
    },
    {
      code: "103.0", name: "Planning Center", type: "revenue", level: 0,
      budget: 680000, actual: 712000, variance: 32000, variancePercent: 4.7,
      children: [
        { code: "103.1", name: "Level 3 ROW", type: "revenue", level: 1, budget: 180000, actual: 188000, variance: 8000, variancePercent: 4.4 },
        { code: "103.2", name: "Level 3 AMEX", type: "revenue", level: 1, budget: 120000, actual: 128000, variance: 8000, variancePercent: 6.7 },
        { code: "103.5", name: "Level 2", type: "revenue", level: 1, budget: 150000, actual: 158000, variance: 8000, variancePercent: 5.3 },
        { code: "103.6", name: "Level 1", type: "revenue", level: 1, budget: 130000, actual: 138000, variance: 8000, variancePercent: 6.2 },
        { code: "103.7", name: "Not a Subscriber", type: "revenue", level: 1, budget: 100000, actual: 100000, variance: 0, variancePercent: 0 },
      ],
    },
    {
      code: "104.0", name: "LAB (Manufacture)", type: "revenue", level: 0,
      budget: 520000, actual: 545000, variance: 25000, variancePercent: 4.8,
      children: [
        { code: "104.1", name: "Level 3 ROW", type: "revenue", level: 1, budget: 140000, actual: 148000, variance: 8000, variancePercent: 5.7 },
        { code: "104.2", name: "Level 3 AMEX", type: "revenue", level: 1, budget: 100000, actual: 105000, variance: 5000, variancePercent: 5.0 },
        { code: "104.5", name: "Level 2", type: "revenue", level: 1, budget: 120000, actual: 128000, variance: 8000, variancePercent: 6.7 },
        { code: "104.6", name: "Level 1", type: "revenue", level: 1, budget: 100000, actual: 104000, variance: 4000, variancePercent: 4.0 },
        { code: "104.7", name: "Not a Subscriber", type: "revenue", level: 1, budget: 60000, actual: 60000, variance: 0, variancePercent: 0 },
      ],
    },
    {
      code: "105.0", name: "Other Income", type: "revenue", level: 0,
      budget: 150000, actual: 162000, variance: 12000, variancePercent: 8.0,
      children: [
        { code: "105.1", name: "Level 1 Subscriptions", type: "revenue", level: 1, budget: 80000, actual: 88000, variance: 8000, variancePercent: 10.0 },
        { code: "105.2", name: "CORE Partnerships", type: "revenue", level: 1, budget: 40000, actual: 42000, variance: 2000, variancePercent: 5.0 },
        { code: "105.3", name: "Study Club", type: "revenue", level: 1, budget: 20000, actual: 22000, variance: 2000, variancePercent: 10.0 },
        { code: "105.4", name: "Other Marketing", type: "revenue", level: 1, budget: 10000, actual: 10000, variance: 0, variancePercent: 0 },
      ],
    },
  ];

  // Expense structure
  const expenseStructure: DRELine[] = [
    {
      code: "201.0", name: "Cost of Goods Sold (COGS)", type: "expense", level: 0,
      budget: 680000, actual: 695000, variance: -15000, variancePercent: -2.2,
      children: [
        { code: "201.1", name: "COGS Growth", type: "expense", level: 1, budget: 180000, actual: 185000, variance: -5000, variancePercent: -2.8 },
        { code: "201.2", name: "COGS Delight", type: "expense", level: 1, budget: 220000, actual: 228000, variance: -8000, variancePercent: -3.6 },
        { code: "201.3", name: "COGS Planning Center", type: "expense", level: 1, budget: 150000, actual: 152000, variance: -2000, variancePercent: -1.3 },
        { code: "201.4", name: "COGS LAB", type: "expense", level: 1, budget: 130000, actual: 130000, variance: 0, variancePercent: 0 },
      ],
    },
    {
      code: "202.0", name: "Labour", type: "expense", level: 0,
      budget: 1450000, actual: 1420000, variance: 30000, variancePercent: 2.1,
      children: [
        { code: "202.1", name: "Labour Growth", type: "expense", level: 1, budget: 280000, actual: 275000, variance: 5000, variancePercent: 1.8 },
        { code: "202.2", name: "Labour Marketing", type: "expense", level: 1, budget: 180000, actual: 175000, variance: 5000, variancePercent: 2.8 },
        { code: "202.3", name: "Labour Planning Center", type: "expense", level: 1, budget: 320000, actual: 315000, variance: 5000, variancePercent: 1.6 },
        { code: "202.4", name: "Labour LAB", type: "expense", level: 1, budget: 280000, actual: 272000, variance: 8000, variancePercent: 2.9 },
        { code: "202.5", name: "Labour Corporate", type: "expense", level: 1, budget: 250000, actual: 248000, variance: 2000, variancePercent: 0.8 },
        { code: "202.6", name: "Labour Delight ROW", type: "expense", level: 1, budget: 80000, actual: 78000, variance: 2000, variancePercent: 2.5 },
        { code: "202.7", name: "Labour AMEX", type: "expense", level: 1, budget: 40000, actual: 38000, variance: 2000, variancePercent: 5.0 },
        { code: "202.8", name: "Social Security", type: "expense", level: 1, budget: 20000, actual: 19000, variance: 1000, variancePercent: 5.0 },
      ],
    },
    {
      code: "203.0", name: "Travels and Meals", type: "expense", level: 0,
      budget: 180000, actual: 172000, variance: 8000, variancePercent: 4.4,
      children: [
        { code: "203.1", name: "T&M Growth", type: "expense", level: 1, budget: 45000, actual: 42000, variance: 3000, variancePercent: 6.7 },
        { code: "203.2", name: "T&M Marketing", type: "expense", level: 1, budget: 35000, actual: 33000, variance: 2000, variancePercent: 5.7 },
        { code: "203.5", name: "T&M Corporate", type: "expense", level: 1, budget: 45000, actual: 44000, variance: 1000, variancePercent: 2.2 },
      ],
    },
    { code: "204.0", name: "Professional Fees", type: "expense", level: 0, budget: 120000, actual: 118000, variance: 2000, variancePercent: 1.7, children: [] },
    { code: "205.0", name: "Marketing and Advertising", type: "expense", level: 0, budget: 95000, actual: 92000, variance: 3000, variancePercent: 3.2, children: [] },
    { code: "206.0", name: "Office", type: "expense", level: 0, budget: 85000, actual: 82000, variance: 3000, variancePercent: 3.5, children: [] },
    { code: "207.0", name: "Information Technology", type: "expense", level: 0, budget: 75000, actual: 78000, variance: -3000, variancePercent: -4.0, children: [] },
    { code: "208.0", name: "Research and Development", type: "expense", level: 0, budget: 45000, actual: 42000, variance: 3000, variancePercent: 6.7, children: [] },
    { code: "209.0", name: "Bank and Financial Fees", type: "expense", level: 0, budget: 35000, actual: 38000, variance: -3000, variancePercent: -8.6, children: [] },
    { code: "210.0", name: "Miscellaneous", type: "expense", level: 0, budget: 25000, actual: 23000, variance: 2000, variancePercent: 8.0, children: [] },
    { code: "211.0", name: "Amortization & Depreciation", type: "expense", level: 0, budget: 40000, actual: 40000, variance: 0, variancePercent: 0, children: [] },
    { code: "300.0", name: "FX Variation", type: "expense", level: 0, budget: 0, actual: -15000, variance: 15000, variancePercent: 0, children: [] },
  ];

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenueBudget = revenueStructure.reduce((sum, r) => sum + r.budget, 0);
    const totalRevenueActual = revenueStructure.reduce((sum, r) => sum + r.actual, 0);
    const totalExpenseBudget = expenseStructure.reduce((sum, e) => sum + e.budget, 0);
    const totalExpenseActual = expenseStructure.reduce((sum, e) => sum + e.actual, 0);

    const cogsBudget = expenseStructure.find((e) => e.code === "201.0")?.budget || 0;
    const cogsActual = expenseStructure.find((e) => e.code === "201.0")?.actual || 0;
    const grossProfitBudget = totalRevenueBudget - cogsBudget;
    const grossProfitActual = totalRevenueActual - cogsActual;

    const opexBudget = expenseStructure.filter((e) => e.code !== "201.0" && e.code !== "211.0").reduce((sum, e) => sum + e.budget, 0);
    const opexActual = expenseStructure.filter((e) => e.code !== "201.0" && e.code !== "211.0").reduce((sum, e) => sum + e.actual, 0);
    const ebitdaBudget = grossProfitBudget - opexBudget;
    const ebitdaActual = grossProfitActual - opexActual;

    const netIncomeBudget = totalRevenueBudget - totalExpenseBudget;
    const netIncomeActual = totalRevenueActual - totalExpenseActual;

    return {
      revenue: { budget: totalRevenueBudget, actual: totalRevenueActual },
      expenses: { budget: totalExpenseBudget, actual: totalExpenseActual },
      grossProfit: { budget: grossProfitBudget, actual: grossProfitActual },
      ebitda: { budget: ebitdaBudget, actual: ebitdaActual },
      netIncome: { budget: netIncomeBudget, actual: netIncomeActual },
    };
  }, []);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, [selectedScope]);

  const toggleSection = (code: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedSections(newExpanded);
  };

  const renderDRELine = (line: DRELine, isChild = false) => {
    const hasChildren = line.children && line.children.length > 0;
    const isExpanded = expandedSections.has(line.code);
    const isPositiveVariance = line.type === "revenue" ? line.variance > 0 : line.variance > 0;

    return (
      <div key={line.code}>
        <div
          className={`grid grid-cols-6 gap-4 py-3 px-4 border-b border-gray-700 hover:bg-gray-800/50 transition-colors ${
            isChild ? "pl-10 bg-gray-800/30" : "bg-gray-900/50"
          }`}
        >
          <div className="col-span-2 flex items-center gap-2">
            {hasChildren ? (
              <button onClick={() => toggleSection(line.code)} className="p-1 hover:bg-gray-700 rounded">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>
            ) : (
              <div className="w-6" />
            )}
            <span className="text-xs text-gray-500 font-mono">{line.code}</span>
            <span className={`text-sm ${isChild ? "text-gray-400" : "font-medium text-white"}`}>{line.name}</span>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-300 font-mono">{formatCurrency(line.budget, "EUR")}</span>
          </div>
          <div className="text-right">
            <span className={`text-sm font-mono font-medium ${line.type === "revenue" ? "text-emerald-400" : "text-red-400"}`}>
              {formatCurrency(line.actual, "EUR")}
            </span>
          </div>
          <div className="text-right">
            <span className={`text-sm font-mono ${isPositiveVariance ? "text-emerald-400" : "text-red-400"}`}>
              {line.variance >= 0 ? "+" : ""}{formatCurrency(line.variance, "EUR")}
            </span>
          </div>
          <div className="text-right">
            <Badge variant="outline" className={`text-xs font-mono ${isPositiveVariance ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-red-500/50 text-red-400 bg-red-500/10"}`}>
              {line.variancePercent >= 0 ? "+" : ""}{line.variancePercent.toFixed(1)}%
            </Badge>
          </div>
        </div>
        {hasChildren && isExpanded && line.children?.map((child) => renderDRELine(child, true))}
      </div>
    );
  };

  const renderSubtotalRow = (label: string, budget: number, actual: number, isProfit = false) => {
    const variance = actual - budget;
    const variancePercent = budget !== 0 ? (variance / budget) * 100 : 0;
    const isPositive = variance >= 0;

    return (
      <div className={`grid grid-cols-6 gap-4 py-4 px-4 ${isProfit ? "bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-y-2 border-blue-500/30" : "bg-gray-800/80 border-y border-gray-600"}`}>
        <div className="col-span-2 flex items-center gap-2">
          <div className="w-6" />
          <span className={`font-semibold ${isProfit ? "text-lg text-blue-300" : "text-white"}`}>{label}</span>
        </div>
        <div className="text-right"><span className="text-sm text-gray-300 font-mono font-semibold">{formatCurrency(budget, "EUR")}</span></div>
        <div className="text-right"><span className={`text-sm font-mono font-bold ${isProfit ? "text-blue-300" : actual >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(actual, "EUR")}</span></div>
        <div className="text-right"><span className={`text-sm font-mono font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>{variance >= 0 ? "+" : ""}{formatCurrency(variance, "EUR")}</span></div>
        <div className="text-right">
          <Badge variant="outline" className={`text-xs font-mono font-semibold ${isPositive ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-red-500/50 text-red-400 bg-red-500/10"}`}>
            {variancePercent >= 0 ? "+" : ""}{variancePercent.toFixed(1)}%
          </Badge>
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
      {/* Dark Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-emerald-400" />
              P&L Statement (DRE)
            </h1>
            <p className="text-sm text-gray-400 mt-1">Demonstração do Resultado do Exercício • {selectedScope === "GLOBAL" ? "All Regions" : selectedScope}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800"><Download className="h-4 w-4 mr-2" />Export</Button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Date Filters */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Period:</span>
              </div>
              <div className="flex items-center gap-3">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40 bg-gray-800 border-gray-700 text-white" />
                <span className="text-gray-500">to</span>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40 bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => { const d = new Date(); d.setMonth(0, 1); setStartDate(d.toISOString().split("T")[0]); setEndDate(new Date().toISOString().split("T")[0]); }}>YTD</Button>
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => { const now = new Date(); const firstDay = new Date(now.getFullYear(), now.getMonth(), 1); setStartDate(firstDay.toISOString().split("T")[0]); setEndDate(now.toISOString().split("T")[0]); }}>MTD</Button>
                <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => { const now = new Date(); const q = Math.floor(now.getMonth() / 3); const firstDay = new Date(now.getFullYear(), q * 3, 1); setStartDate(firstDay.toISOString().split("T")[0]); setEndDate(now.toISOString().split("T")[0]); }}>QTD</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/60 border-emerald-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-5 w-5 text-emerald-400" /><span className="text-sm font-medium text-emerald-300">Total Revenue</span></div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.revenue.actual, "EUR")}</p>
              <p className="text-xs text-emerald-400 mt-1">+{formatCurrency(totals.revenue.actual - totals.revenue.budget, "EUR")} vs budget</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-900/40 to-blue-950/60 border-blue-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><Layers className="h-5 w-5 text-blue-400" /><span className="text-sm font-medium text-blue-300">Gross Profit</span></div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.grossProfit.actual, "EUR")}</p>
              <p className="text-xs text-blue-400 mt-1">{((totals.grossProfit.actual / totals.revenue.actual) * 100).toFixed(1)}% margin</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-900/40 to-red-950/60 border-red-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-5 w-5 text-red-400" /><span className="text-sm font-medium text-red-300">Total Expenses</span></div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.expenses.actual, "EUR")}</p>
              <p className="text-xs text-emerald-400 mt-1">{formatCurrency(totals.expenses.budget - totals.expenses.actual, "EUR")} under budget</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-900/40 to-purple-950/60 border-purple-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><Building2 className="h-5 w-5 text-purple-400" /><span className="text-sm font-medium text-purple-300">EBITDA</span></div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.ebitda.actual, "EUR")}</p>
              <p className="text-xs text-purple-400 mt-1">{((totals.ebitda.actual / totals.revenue.actual) * 100).toFixed(1)}% margin</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-900/40 to-amber-950/60 border-amber-800/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><DollarSign className="h-5 w-5 text-amber-400" /><span className="text-sm font-medium text-amber-300">Net Income</span></div>
              <p className="text-2xl font-bold text-white">{formatCurrency(totals.netIncome.actual, "EUR")}</p>
              <p className="text-xs text-amber-400 mt-1">{((totals.netIncome.actual / totals.revenue.actual) * 100).toFixed(1)}% margin</p>
            </CardContent>
          </Card>
        </div>

        {/* DRE Table */}
        <Card className="bg-gray-900 border-gray-800 overflow-hidden">
          <CardHeader className="border-b border-gray-800 bg-gray-900/50">
            <CardTitle className="text-white flex items-center gap-2"><Filter className="h-5 w-5 text-gray-400" />Income Statement Detail</CardTitle>
          </CardHeader>

          {/* Table Header */}
          <div className="grid grid-cols-6 gap-4 py-3 px-4 bg-gray-800/80 border-b border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <div className="col-span-2">Account</div>
            <div className="text-right">Budget</div>
            <div className="text-right">Actual</div>
            <div className="text-right">Variance</div>
            <div className="text-right">Var %</div>
          </div>

          {/* Revenue Section */}
          <div className="bg-emerald-900/30 border-b border-emerald-800/50 py-2 px-4">
            <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">▼ Revenue</span>
          </div>
          {revenueStructure.map((line) => renderDRELine(line))}
          {renderSubtotalRow("TOTAL REVENUE", totals.revenue.budget, totals.revenue.actual)}

          {/* Expenses Section */}
          <div className="bg-red-900/30 border-b border-red-800/50 py-2 px-4 mt-2">
            <span className="text-sm font-bold text-red-400 uppercase tracking-wider">▼ Expenses</span>
          </div>
          {expenseStructure.map((line) => renderDRELine(line))}
          {renderSubtotalRow("TOTAL EXPENSES", totals.expenses.budget, totals.expenses.actual)}

          {/* Subtotals */}
          {renderSubtotalRow("GROSS PROFIT", totals.grossProfit.budget, totals.grossProfit.actual, true)}
          {renderSubtotalRow("EBITDA", totals.ebitda.budget, totals.ebitda.actual, true)}

          {/* Net Income */}
          <div className="bg-gradient-to-r from-amber-900/50 to-orange-900/50 border-y-2 border-amber-500/50 py-5 px-4">
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-2 flex items-center gap-2">
                <div className="w-6" />
                <DollarSign className="h-6 w-6 text-amber-400" />
                <span className="text-xl font-bold text-amber-300">NET INCOME</span>
              </div>
              <div className="text-right"><span className="text-lg text-gray-300 font-mono font-semibold">{formatCurrency(totals.netIncome.budget, "EUR")}</span></div>
              <div className="text-right"><span className="text-xl font-mono font-bold text-amber-300">{formatCurrency(totals.netIncome.actual, "EUR")}</span></div>
              <div className="text-right">
                <span className={`text-lg font-mono font-semibold ${totals.netIncome.actual >= totals.netIncome.budget ? "text-emerald-400" : "text-red-400"}`}>
                  {totals.netIncome.actual >= totals.netIncome.budget ? "+" : ""}{formatCurrency(totals.netIncome.actual - totals.netIncome.budget, "EUR")}
                </span>
              </div>
              <div className="text-right">
                <Badge className="text-sm font-mono font-semibold bg-amber-500/20 text-amber-300 border-amber-500/50">
                  {totals.netIncome.budget !== 0 ? `${(((totals.netIncome.actual - totals.netIncome.budget) / totals.netIncome.budget) * 100).toFixed(1)}%` : "N/A"}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
