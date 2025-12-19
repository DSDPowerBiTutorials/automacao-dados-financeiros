"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Department {
  name: string;
  code: string;
  subDepartments: SubDepartment[];
}

interface SubDepartment {
  name: string;
  code: string;
  personalAssignment: number;
}

interface LineItem {
  category: string;
  description: string;
  isSubtotal?: boolean;
  isPercentage?: boolean;
  values: {
    [key: string]: {
      budget: number;
      incurred: number;
    };
  };
}

export default function PnLReport() {
  const [selectedPeriod, setSelectedPeriod] = useState("2024-Q1");

  // Estrutura de departamentos e sub-departamentos com Personal Assignment
  const departments: Department[] = [
    {
      name: "Education",
      code: "1.0.0",
      subDepartments: [
        { name: "Education", code: "1.1.0", personalAssignment: 12 },
        { name: "Labour Growth", code: "202.1", personalAssignment: 8 },
      ],
    },
    {
      name: "Lab",
      code: "2.0.0",
      subDepartments: [
        { name: "Lab", code: "2.1.0", personalAssignment: 15 },
        { name: "Planning Center", code: "2.1.1", personalAssignment: 10 },
        { name: "Delight", code: "2.1.2", personalAssignment: 8 },
        { name: "Labour LAB", code: "202.4", personalAssignment: 12 },
      ],
    },
    {
      name: "Corporate",
      code: "3.0.0",
      subDepartments: [
        { name: "Corporate", code: "3.1.0", personalAssignment: 18 },
        { name: "Finance", code: "3.1.1", personalAssignment: 6 },
        { name: "Marketing", code: "3.1.2", personalAssignment: 5 },
        { name: "Labour Corporate", code: "202.5", personalAssignment: 14 },
      ],
    },
  ];

  // Dados fictícios do P&L seguindo a estrutura exata
  const revenueItems: LineItem[] = [
    {
      category: "Revenue",
      description: "Product Sales",
      values: {
        "1.1.0": { budget: 450000, incurred: 478000 },
        "202.1": { budget: 125000, incurred: 132000 },
        "2.1.0": { budget: 680000, incurred: 695000 },
        "2.1.1": { budget: 340000, incurred: 355000 },
        "2.1.2": { budget: 280000, incurred: 295000 },
        "202.4": { budget: 180000, incurred: 175000 },
        "3.1.0": { budget: 520000, incurred: 545000 },
        "3.1.1": { budget: 0, incurred: 0 },
        "3.1.2": { budget: 0, incurred: 0 },
        "202.5": { budget: 0, incurred: 0 },
      },
    },
    {
      category: "Revenue",
      description: "Service Revenue",
      values: {
        "1.1.0": { budget: 180000, incurred: 195000 },
        "202.1": { budget: 45000, incurred: 48000 },
        "2.1.0": { budget: 320000, incurred: 335000 },
        "2.1.1": { budget: 160000, incurred: 168000 },
        "2.1.2": { budget: 120000, incurred: 125000 },
        "202.4": { budget: 85000, incurred: 88000 },
        "3.1.0": { budget: 240000, incurred: 255000 },
        "3.1.1": { budget: 0, incurred: 0 },
        "3.1.2": { budget: 0, incurred: 0 },
        "202.5": { budget: 0, incurred: 0 },
      },
    },
    {
      category: "Revenue",
      description: "Consulting Fees",
      values: {
        "1.1.0": { budget: 95000, incurred: 102000 },
        "202.1": { budget: 28000, incurred: 30000 },
        "2.1.0": { budget: 145000, incurred: 152000 },
        "2.1.1": { budget: 75000, incurred: 78000 },
        "2.1.2": { budget: 65000, incurred: 68000 },
        "202.4": { budget: 42000, incurred: 45000 },
        "3.1.0": { budget: 110000, incurred: 118000 },
        "3.1.1": { budget: 0, incurred: 0 },
        "3.1.2": { budget: 0, incurred: 0 },
        "202.5": { budget: 0, incurred: 0 },
      },
    },
  ];

  const fixedCostItems: LineItem[] = [
    {
      category: "Fixed Cost",
      description: "Office / Facilities",
      values: {
        "1.1.0": { budget: 0, incurred: 0 },
        "202.1": { budget: 0, incurred: 0 },
        "2.1.0": { budget: 0, incurred: 0 },
        "2.1.1": { budget: 0, incurred: 0 },
        "2.1.2": { budget: 0, incurred: 0 },
        "202.4": { budget: 0, incurred: 0 },
        "3.1.0": { budget: 0, incurred: 0 },
        "3.1.1": { budget: 0, incurred: 0 },
        "3.1.2": { budget: 0, incurred: 0 },
        "202.5": { budget: 0, incurred: 0 },
      },
    },
    {
      category: "Fixed Cost",
      description: "Office Rent Cost",
      values: {
        "1.1.0": { budget: 45000, incurred: 45000 },
        "202.1": { budget: 12000, incurred: 12000 },
        "2.1.0": { budget: 68000, incurred: 68000 },
        "2.1.1": { budget: 34000, incurred: 34000 },
        "2.1.2": { budget: 28000, incurred: 28000 },
        "202.4": { budget: 18000, incurred: 18000 },
        "3.1.0": { budget: 52000, incurred: 52000 },
        "3.1.1": { budget: 15000, incurred: 15000 },
        "3.1.2": { budget: 12000, incurred: 12000 },
        "202.5": { budget: 8000, incurred: 8000 },
      },
    },
    {
      category: "Fixed Cost",
      description: "Office Operational Cost Fixed",
      values: {
        "1.1.0": { budget: 18000, incurred: 18500 },
        "202.1": { budget: 5000, incurred: 5200 },
        "2.1.0": { budget: 28000, incurred: 28800 },
        "2.1.1": { budget: 14000, incurred: 14400 },
        "2.1.2": { budget: 11000, incurred: 11300 },
        "202.4": { budget: 7500, incurred: 7700 },
        "3.1.0": { budget: 22000, incurred: 22600 },
        "3.1.1": { budget: 6000, incurred: 6200 },
        "3.1.2": { budget: 5000, incurred: 5100 },
        "202.5": { budget: 3500, incurred: 3600 },
      },
    },
    {
      category: "Fixed Cost",
      description: "Office Operational Cost General",
      values: {
        "1.1.0": { budget: 25000, incurred: 25000 },
        "202.1": { budget: 7000, incurred: 7000 },
        "2.1.0": { budget: 38000, incurred: 38000 },
        "2.1.1": { budget: 19000, incurred: 19000 },
        "2.1.2": { budget: 15000, incurred: 15000 },
        "202.4": { budget: 10000, incurred: 10000 },
        "3.1.0": { budget: 30000, incurred: 30000 },
        "3.1.1": { budget: 8000, incurred: 8000 },
        "3.1.2": { budget: 7000, incurred: 7000 },
        "202.5": { budget: 5000, incurred: 5000 },
      },
    },
  ];

  const operationsItems: LineItem[] = [
    {
      category: "Operations",
      description: "Operations (Salaries)",
      values: {
        "1.1.0": { budget: 185000, incurred: 185000 },
        "202.1": { budget: 95000, incurred: 95000 },
        "2.1.0": { budget: 285000, incurred: 285000 },
        "2.1.1": { budget: 142000, incurred: 142000 },
        "2.1.2": { budget: 115000, incurred: 115000 },
        "202.4": { budget: 165000, incurred: 165000 },
        "3.1.0": { budget: 225000, incurred: 225000 },
        "3.1.1": { budget: 125000, incurred: 125000 },
        "3.1.2": { budget: 95000, incurred: 95000 },
        "202.5": { budget: 185000, incurred: 185000 },
      },
    },
    {
      category: "Operations",
      description: "Marketing",
      values: {
        "1.1.0": { budget: 65000, incurred: 72000 },
        "202.1": { budget: 18000, incurred: 20000 },
        "2.1.0": { budget: 95000, incurred: 105000 },
        "2.1.1": { budget: 48000, incurred: 53000 },
        "2.1.2": { budget: 38000, incurred: 42000 },
        "202.4": { budget: 25000, incurred: 28000 },
        "3.1.0": { budget: 125000, incurred: 138000 },
        "3.1.1": { budget: 8000, incurred: 8800 },
        "3.1.2": { budget: 85000, incurred: 94000 },
        "202.5": { budget: 12000, incurred: 13200 },
      },
    },
    {
      category: "Operations",
      description: "Department Operational Cost",
      values: {
        "1.1.0": { budget: 85000, incurred: 92000 },
        "202.1": { budget: 22000, incurred: 24000 },
        "2.1.0": { budget: 145000, incurred: 158000 },
        "2.1.1": { budget: 72000, incurred: 78000 },
        "2.1.2": { budget: 58000, incurred: 63000 },
        "202.4": { budget: 38000, incurred: 41000 },
        "3.1.0": { budget: 95000, incurred: 103000 },
        "3.1.1": { budget: 12000, incurred: 13000 },
        "3.1.2": { budget: 18000, incurred: 19500 },
        "202.5": { budget: 8000, incurred: 8700 },
      },
    },
  ];

  const variableCostItems: LineItem[] = [
    {
      category: "Variable Cost",
      description: "Dedicated Cost",
      values: {
        "1.1.0": { budget: 131000, incurred: 145000 },
        "202.1": { budget: 35500, incurred: 39300 },
        "2.1.0": { budget: 195000, incurred: 215500 },
        "2.1.1": { budget: 98000, incurred: 108200 },
        "2.1.2": { budget: 78000, incurred: 86300 },
        "202.4": { budget: 51000, incurred: 56700 },
        "3.1.0": { budget: 252000, incurred: 278500 },
        "3.1.1": { budget: 54000, incurred: 59400 },
        "3.1.2": { budget: 128000, incurred: 141900 },
        "202.5": { budget: 26000, incurred: 28800 },
      },
    },
  ];

  // Função para calcular totais por sub-departamento
  const calculateSubDeptTotal = (
    items: LineItem[],
    subDeptCode: string,
    type: "budget" | "incurred",
  ) => {
    return items.reduce((sum, item) => {
      if (item.isSubtotal || item.isPercentage) return sum;
      return sum + (item.values[subDeptCode]?.[type] || 0);
    }, 0);
  };

  // Função para calcular totais por departamento
  const calculateDeptTotal = (
    items: LineItem[],
    dept: Department,
    type: "budget" | "incurred",
  ) => {
    return dept.subDepartments.reduce((sum, subDept) => {
      return sum + calculateSubDeptTotal(items, subDept.code, type);
    }, 0);
  };

  // Função para calcular grand total
  const calculateGrandTotal = (
    items: LineItem[],
    type: "budget" | "incurred",
  ) => {
    return departments.reduce((sum, dept) => {
      return sum + calculateDeptTotal(items, dept, type);
    }, 0);
  };

  // Calcular totais de receita
  const totalRevenueBudget = calculateGrandTotal(revenueItems, "budget");
  const totalRevenueIncurred = calculateGrandTotal(revenueItems, "incurred");

  // Calcular totais de custos fixos
  const totalFixedCostBudget = calculateGrandTotal(fixedCostItems, "budget");
  const totalFixedCostIncurred = calculateGrandTotal(
    fixedCostItems,
    "incurred",
  );

  // Calcular totais de operações
  const totalOperationsBudget = calculateGrandTotal(operationsItems, "budget");
  const totalOperationsIncurred = calculateGrandTotal(
    operationsItems,
    "incurred",
  );

  // Calcular totais de custos variáveis
  const totalVariableCostBudget = calculateGrandTotal(
    variableCostItems,
    "budget",
  );
  const totalVariableCostIncurred = calculateGrandTotal(
    variableCostItems,
    "incurred",
  );

  // Calcular total de custos
  const totalCostsBudget =
    totalFixedCostBudget + totalOperationsBudget + totalVariableCostBudget;
  const totalCostsIncurred =
    totalFixedCostIncurred +
    totalOperationsIncurred +
    totalVariableCostIncurred;

  // Calcular custo administrativo (15%)
  const adminCostBudget = totalCostsBudget * 0.15;
  const adminCostIncurred = totalCostsIncurred * 0.15;

  // Calcular custo total de operação
  const totalCostOfOperationBudget = totalCostsBudget + adminCostBudget;
  const totalCostOfOperationIncurred = totalCostsIncurred + adminCostIncurred;

  // Calcular lucro/deficit
  const profitDeficitBudget = totalRevenueBudget - totalCostOfOperationBudget;
  const profitDeficitIncurred =
    totalRevenueIncurred - totalCostOfOperationIncurred;

  // Calcular margem operacional
  const operatingMarginBudget =
    totalRevenueBudget > 0
      ? (profitDeficitBudget / totalRevenueBudget) * 100
      : 0;
  const operatingMarginIncurred =
    totalRevenueIncurred > 0
      ? (profitDeficitIncurred / totalRevenueIncurred) * 100
      : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getVarianceColor = (budget: number, incurred: number) => {
    const variance = ((incurred - budget) / budget) * 100;
    if (Math.abs(variance) < 5) return "text-gray-600 dark:text-gray-400";
    return variance > 0
      ? "text-red-600 dark:text-red-400"
      : "text-green-600 dark:text-green-400";
  };

  const renderLineItem = (item: LineItem, idx: number) => {
    return (
      <div
        key={idx}
        className="grid grid-cols-[250px_repeat(10,1fr)] gap-0 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"
      >
        <div
          className={`px-4 py-3 text-sm ${item.isSubtotal ? "font-bold" : "font-medium"} text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700`}
        >
          {item.description}
        </div>
        {departments.flatMap((dept) =>
          dept.subDepartments.map((subDept) => {
            const data = item.values[subDept.code];
            const variance =
              data && data.budget !== 0
                ? ((data.incurred - data.budget) / data.budget) * 100
                : 0;
            return (
              <div
                key={subDept.code}
                className="px-2 py-3 text-right border-r border-gray-200 dark:border-gray-700"
              >
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {item.isPercentage
                    ? formatPercentage(data?.budget || 0)
                    : formatCurrency(data?.budget || 0)}
                </div>
                <div
                  className={`text-xs font-semibold ${getVarianceColor(data?.budget || 0, data?.incurred || 0)}`}
                >
                  {item.isPercentage
                    ? formatPercentage(data?.incurred || 0)
                    : formatCurrency(data?.incurred || 0)}
                </div>
                {data && !item.isPercentage && (
                  <div
                    className={`text-xs ${variance > 0 ? "text-red-500" : variance < 0 ? "text-green-500" : "text-gray-400"}`}
                  >
                    {variance > 0 ? "+" : ""}
                    {variance.toFixed(1)}%
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    );
  };

  const renderCategorySection = (
    title: string,
    items: LineItem[],
    bgColor: string,
  ) => {
    return (
      <div className="mb-0">
        <div
          className={`${bgColor} px-4 py-3 font-bold text-white text-sm sticky top-0 z-10`}
        >
          {title}
        </div>
        {items.map((item, idx) => renderLineItem(item, idx))}
      </div>
    );
  };

  const renderSubtotalRow = (
    title: string,
    items: LineItem[],
    bgColor: string = "bg-gray-100 dark:bg-slate-800",
  ) => {
    return (
      <div
        className={`grid grid-cols-[250px_repeat(10,1fr)] gap-0 ${bgColor} font-bold border-y border-gray-300 dark:border-gray-600`}
      >
        <div className="px-4 py-3 text-sm text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">
          {title}
        </div>
        {departments.flatMap((dept) =>
          dept.subDepartments.map((subDept) => {
            const budget = calculateSubDeptTotal(items, subDept.code, "budget");
            const incurred = calculateSubDeptTotal(
              items,
              subDept.code,
              "incurred",
            );
            const variance =
              budget > 0 ? ((incurred - budget) / budget) * 100 : 0;
            return (
              <div
                key={subDept.code}
                className="px-2 py-3 text-right border-r border-gray-300 dark:border-gray-600"
              >
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  {formatCurrency(budget)}
                </div>
                <div
                  className={`text-xs font-bold ${getVarianceColor(budget, incurred)}`}
                >
                  {formatCurrency(incurred)}
                </div>
                <div
                  className={`text-xs ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-gray-500"}`}
                >
                  {variance > 0 ? "+" : ""}
                  {variance.toFixed(1)}%
                </div>
              </div>
            );
          }),
        )}
      </div>
    );
  };

  const renderCalculatedRow = (
    title: string,
    budgetValue: number,
    incurredValue: number,
    bgColor: string = "bg-white dark:bg-slate-900",
  ) => {
    return (
      <div
        className={`grid grid-cols-[250px_repeat(10,1fr)] gap-0 ${bgColor} font-bold border-b border-gray-300 dark:border-gray-600`}
      >
        <div className="px-4 py-3 text-sm text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">
          {title}
        </div>
        {departments.flatMap((dept) =>
          dept.subDepartments.map((subDept) => {
            // Para linhas calculadas, distribuímos proporcionalmente
            const subDeptRevenue = calculateSubDeptTotal(
              revenueItems,
              subDept.code,
              "incurred",
            );
            const proportion =
              totalRevenueIncurred > 0
                ? subDeptRevenue / totalRevenueIncurred
                : 0;
            const budget = budgetValue * proportion;
            const incurred = incurredValue * proportion;
            const variance =
              budget > 0 ? ((incurred - budget) / budget) * 100 : 0;
            return (
              <div
                key={subDept.code}
                className="px-2 py-3 text-right border-r border-gray-300 dark:border-gray-600"
              >
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  {formatCurrency(budget)}
                </div>
                <div
                  className={`text-xs font-bold ${getVarianceColor(budget, incurred)}`}
                >
                  {formatCurrency(incurred)}
                </div>
                <div
                  className={`text-xs ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-gray-500"}`}
                >
                  {variance > 0 ? "+" : ""}
                  {variance.toFixed(1)}%
                </div>
              </div>
            );
          }),
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">

      <div className="">
        <header className="border-b border-[#0f1c34] bg-[#1a2b4a] text-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 md:ml-0 ml-12">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">
                    DSD Departmental P&L
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Profit & Loss Statement by Department
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Select
                  value={selectedPeriod}
                  onValueChange={setSelectedPeriod}
                >
                  <SelectTrigger className="w-[180px] border-[#1a2b4a]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-Q1">2024 Q1</SelectItem>
                    <SelectItem value="2024-Q2">2024 Q2</SelectItem>
                    <SelectItem value="2024-Q3">2024 Q3</SelectItem>
                    <SelectItem value="2024-Q4">2024 Q4</SelectItem>
                    <SelectItem value="2024-YTD">2024 YTD</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export Report</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Total Revenue
                </CardTitle>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatCurrency(totalRevenueIncurred)}
                </div>
                <div className="text-xs text-white/70">
                  Budget: {formatCurrency(totalRevenueBudget)}
                </div>
                <div
                  className={`text-xs font-semibold mt-1 ${totalRevenueIncurred > totalRevenueBudget ? "text-white" : "text-white/70"}`}
                >
                  {totalRevenueIncurred > totalRevenueBudget ? "+" : ""}
                  {formatPercentage(
                    ((totalRevenueIncurred - totalRevenueBudget) /
                      totalRevenueBudget) *
                      100,
                  )}{" "}
                  vs Budget
                </div>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Total Costs
                </CardTitle>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatCurrency(totalCostOfOperationIncurred)}
                </div>
                <div className="text-xs text-white/70">
                  Budget: {formatCurrency(totalCostOfOperationBudget)}
                </div>
                <div
                  className={`text-xs font-semibold mt-1 ${totalCostOfOperationIncurred < totalCostOfOperationBudget ? "text-white" : "text-white/70"}`}
                >
                  {totalCostOfOperationIncurred > totalCostOfOperationBudget
                    ? "+"
                    : ""}
                  {formatPercentage(
                    ((totalCostOfOperationIncurred -
                      totalCostOfOperationBudget) /
                      totalCostOfOperationBudget) *
                      100,
                  )}{" "}
                  vs Budget
                </div>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Profit / Deficit
                </CardTitle>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatCurrency(profitDeficitIncurred)}
                </div>
                <div className="text-xs text-white/70">
                  Budget: {formatCurrency(profitDeficitBudget)}
                </div>
                <div
                  className={`text-xs font-semibold mt-1 ${profitDeficitIncurred > profitDeficitBudget ? "text-white" : "text-white/70"}`}
                >
                  {profitDeficitIncurred > profitDeficitBudget ? "+" : ""}
                  {formatPercentage(
                    ((profitDeficitIncurred - profitDeficitBudget) /
                      profitDeficitBudget) *
                      100,
                  )}{" "}
                  vs Budget
                </div>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#4fc3f7] to-[#00bcd4] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Operating Margin
                </CardTitle>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatPercentage(operatingMarginIncurred)}
                </div>
                <div className="text-xs text-white/70">
                  Budget: {formatPercentage(operatingMarginBudget)}
                </div>
                <div
                  className={`text-xs font-semibold mt-1 ${operatingMarginIncurred > operatingMarginBudget ? "text-white" : "text-white/70"}`}
                >
                  {operatingMarginIncurred > operatingMarginBudget ? "+" : ""}
                  {(operatingMarginIncurred - operatingMarginBudget).toFixed(1)}
                  pp vs Budget
                </div>
              </div>
            </Card>
          </div>

          {/* P&L Table */}
          <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle className="text-xl">
                Departmental P&L Statement
              </CardTitle>
              <CardDescription className="text-white/80">
                Budget vs Incurred - {selectedPeriod}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {/* Header Row - Departments */}
                <div className="grid grid-cols-[250px_repeat(10,1fr)] gap-0 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 border-b-2 border-gray-300 dark:border-gray-600 sticky top-0 z-20">
                  <div className="px-4 py-4 font-bold text-sm text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">
                    Category
                  </div>
                  {departments.map((dept) => (
                    <div
                      key={dept.code}
                      className={`col-span-${dept.subDepartments.length} text-center border-r border-gray-300 dark:border-gray-600`}
                    >
                      <div className="px-2 py-2 font-bold text-sm text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-600">
                        {dept.name} ({dept.code})
                      </div>
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${dept.subDepartments.length}, 1fr)`,
                        }}
                      >
                        {dept.subDepartments.map((subDept) => (
                          <div
                            key={subDept.code}
                            className="px-2 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-700"
                          >
                            {subDept.name}
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                              ({subDept.code})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Personal Assignment Row */}
                <div className="grid grid-cols-[250px_repeat(10,1fr)] gap-0 bg-blue-50 dark:bg-blue-950/30 border-b-2 border-blue-200 dark:border-blue-800">
                  <div className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white border-r border-blue-200 dark:border-blue-800">
                    Personal Assignment
                  </div>
                  {departments.flatMap((dept) =>
                    dept.subDepartments.map((subDept) => (
                      <div
                        key={subDept.code}
                        className="px-2 py-3 text-center border-r border-blue-200 dark:border-blue-800"
                      >
                        <div className="text-sm font-bold text-blue-700 dark:text-blue-400">
                          {subDept.personalAssignment}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          people
                        </div>
                      </div>
                    )),
                  )}
                </div>

                {/* Revenue Section */}
                {renderCategorySection(
                  "REVENUE",
                  revenueItems,
                  "bg-gradient-to-r from-emerald-500 to-emerald-600",
                )}

                {/* Fixed Cost Section */}
                {renderCategorySection(
                  "FIXED COST",
                  fixedCostItems,
                  "bg-gradient-to-r from-blue-500 to-blue-600",
                )}
                {renderSubtotalRow("Total", fixedCostItems)}

                {/* Percentage Row */}
                <div className="grid grid-cols-[250px_repeat(10,1fr)] gap-0 bg-blue-50 dark:bg-blue-950/20 border-b border-gray-300 dark:border-gray-600">
                  <div className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white border-r border-gray-300 dark:border-gray-600">
                    %
                  </div>
                  {departments.flatMap((dept) =>
                    dept.subDepartments.map((subDept) => {
                      const fixedCostBudget = calculateSubDeptTotal(
                        fixedCostItems,
                        subDept.code,
                        "budget",
                      );
                      const fixedCostIncurred = calculateSubDeptTotal(
                        fixedCostItems,
                        subDept.code,
                        "incurred",
                      );
                      const revenueBudget = calculateSubDeptTotal(
                        revenueItems,
                        subDept.code,
                        "budget",
                      );
                      const revenueIncurred = calculateSubDeptTotal(
                        revenueItems,
                        subDept.code,
                        "incurred",
                      );
                      const percentBudget =
                        revenueBudget > 0
                          ? (fixedCostBudget / revenueBudget) * 100
                          : 0;
                      const percentIncurred =
                        revenueIncurred > 0
                          ? (fixedCostIncurred / revenueIncurred) * 100
                          : 0;
                      return (
                        <div
                          key={subDept.code}
                          className="px-2 py-3 text-right border-r border-gray-300 dark:border-gray-600"
                        >
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {formatPercentage(percentBudget)}
                          </div>
                          <div className="text-xs font-bold text-blue-700 dark:text-blue-400">
                            {formatPercentage(percentIncurred)}
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>

                {/* Operations Section */}
                {renderCategorySection(
                  "OPERATIONS",
                  operationsItems,
                  "bg-gradient-to-r from-purple-500 to-purple-600",
                )}
                {renderSubtotalRow("Total", operationsItems)}

                {/* Variable Cost Section */}
                {renderCategorySection(
                  "VARIABLE COST",
                  variableCostItems,
                  "bg-gradient-to-r from-orange-500 to-orange-600",
                )}

                {/* Total Cost Row */}
                {renderSubtotalRow(
                  "TOTAL COST",
                  [...fixedCostItems, ...operationsItems, ...variableCostItems],
                  "bg-red-100 dark:bg-red-900/30",
                )}

                {/* Administrative Cost (15%) */}
                {renderCalculatedRow(
                  "Administrative Cost (15%)",
                  adminCostBudget,
                  adminCostIncurred,
                  "bg-orange-50 dark:bg-orange-950/20",
                )}

                {/* Total Cost of Operation */}
                {renderCalculatedRow(
                  "Total Cost of Operation",
                  totalCostOfOperationBudget,
                  totalCostOfOperationIncurred,
                  "bg-red-100 dark:bg-red-900/30",
                )}

                {/* Profit/Deficit Row */}
                <div className="grid grid-cols-[250px_repeat(10,1fr)] gap-0 bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white font-bold border-y-2 border-[#1a2b4a]">
                  <div className="px-4 py-4 text-sm border-r border-white/20">
                    Profit / Deficit
                  </div>
                  {departments.flatMap((dept) =>
                    dept.subDepartments.map((subDept) => {
                      const revenueBudget = calculateSubDeptTotal(
                        revenueItems,
                        subDept.code,
                        "budget",
                      );
                      const revenueIncurred = calculateSubDeptTotal(
                        revenueItems,
                        subDept.code,
                        "incurred",
                      );
                      const costsBudget =
                        calculateSubDeptTotal(
                          fixedCostItems,
                          subDept.code,
                          "budget",
                        ) +
                        calculateSubDeptTotal(
                          operationsItems,
                          subDept.code,
                          "budget",
                        ) +
                        calculateSubDeptTotal(
                          variableCostItems,
                          subDept.code,
                          "budget",
                        );
                      const costsIncurred =
                        calculateSubDeptTotal(
                          fixedCostItems,
                          subDept.code,
                          "incurred",
                        ) +
                        calculateSubDeptTotal(
                          operationsItems,
                          subDept.code,
                          "incurred",
                        ) +
                        calculateSubDeptTotal(
                          variableCostItems,
                          subDept.code,
                          "incurred",
                        );

                      // Adicionar custo administrativo proporcional
                      const subDeptRevenue = calculateSubDeptTotal(
                        revenueItems,
                        subDept.code,
                        "incurred",
                      );
                      const proportion =
                        totalRevenueIncurred > 0
                          ? subDeptRevenue / totalRevenueIncurred
                          : 0;
                      const adminBudget = adminCostBudget * proportion;
                      const adminIncurred = adminCostIncurred * proportion;

                      const profitBudget =
                        revenueBudget - (costsBudget + adminBudget);
                      const profitIncurred =
                        revenueIncurred - (costsIncurred + adminIncurred);
                      const variance =
                        profitBudget !== 0
                          ? ((profitIncurred - profitBudget) /
                              Math.abs(profitBudget)) *
                            100
                          : 0;
                      return (
                        <div
                          key={subDept.code}
                          className="px-2 py-4 text-right border-r border-white/20"
                        >
                          <div className="text-xs text-white/70">
                            {formatCurrency(profitBudget)}
                          </div>
                          <div className="text-xs font-bold">
                            {formatCurrency(profitIncurred)}
                          </div>
                          <div
                            className={`text-xs ${profitIncurred > profitBudget ? "text-green-300" : profitIncurred < profitBudget ? "text-red-300" : "text-white/50"}`}
                          >
                            {variance > 0 ? "+" : ""}
                            {variance.toFixed(1)}%
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="mt-6 p-4 bg-white dark:bg-slate-900 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              Legend
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  First Line:
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2">
                  Budget Amount
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Second Line:
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2">
                  Incurred Amount
                </span>
              </div>
              <div>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Third Line:
                </span>
                <span className="text-gray-600 dark:text-gray-400 ml-2">
                  Variance %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
