"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { useAuth } from "@/contexts/auth-context";

import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { KPIStrip, KPIData } from "@/components/dashboard/KPIStrip";
import {
  CashFlowAreaChart,
  CashFlowPoint,
} from "@/components/dashboard/CashFlowAreaChart";
import {
  RevenueByChannelChart,
  ChannelData,
} from "@/components/dashboard/RevenueByChannelChart";
import {
  ExpensesByCostCenter,
  CostCenterData,
} from "@/components/dashboard/ExpensesByCostCenter";
import {
  BankBalancesCards,
  BankBalance,
} from "@/components/dashboard/BankBalancesCards";
import {
  ReconciliationStatus,
  ReconciliationSource,
  getSourceColor,
} from "@/components/dashboard/ReconciliationStatus";
import {
  RecentTransactions,
  RecentTransaction,
} from "@/components/dashboard/RecentTransactions";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-[#1e2433] ${className || ""}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-bg px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonPulse className="h-7 w-64" />
          <SkeletonPulse className="h-4 w-40" />
        </div>
        <div className="flex gap-3">
          <SkeletonPulse className="h-9 w-24" />
          <SkeletonPulse className="h-9 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonPulse key={i} className="h-24" />
        ))}
      </div>
      <SkeletonPulse className="h-[380px]" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonPulse className="h-80" />
        <SkeletonPulse className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonPulse className="h-72" />
        <SkeletonPulse className="h-72" />
      </div>
      <SkeletonPulse className="h-64" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source label helpers
// ---------------------------------------------------------------------------
const SOURCE_LABELS: Record<string, string> = {
  "bankinter-eur": "Bankinter EUR",
  "bankinter-usd": "Bankinter USD",
  "sabadell-eur": "Sabadell EUR",
  "chase-usd": "Chase USD",
  "braintree-eur": "Braintree EUR",
  "braintree-usd": "Braintree USD",
  "braintree-gbp": "Braintree GBP",
  "braintree-aud": "Braintree AUD",
  "braintree-amex": "Braintree Amex",
  "braintree-transactions": "Braintree Trans.",
  "stripe-eur": "Stripe EUR",
  "stripe-usd": "Stripe USD",
  stripe: "Stripe",
  gocardless: "GoCardless",
  paypal: "PayPal",
  pleo: "Pleo",
};

const BANK_LABELS: Record<string, { bank: string; currency: string }> = {
  "bankinter-eur": { bank: "Bankinter", currency: "EUR" },
  "bankinter-usd": { bank: "Bankinter", currency: "USD" },
  "sabadell": { bank: "Sabadell", currency: "EUR" },
  "chase-usd": { bank: "Chase", currency: "USD" },
};

const CHANNEL_COLORS: Record<string, string> = {
  Braintree: "#818cf8",
  Stripe: "#a78bfa",
  GoCardless: "#fbbf24",
  PayPal: "#60a5fa",
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const { selectedScope } = useGlobalScope();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [showIntercompany, setShowIntercompany] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData>({
    revenueMonth: 0,
    expenseMonth: 0,
    netResult: 0,
    reconciliationRate: 0,
    pendingTransactions: 0,
    totalBankBalance: 0,
    intercompanyRevenue: 0,
    intercompanyExpense: 0,
    bankBalanceDate: "",
  });
  const [cashFlowData, setCashFlowData] = useState<CashFlowPoint[]>([]);
  const [channelData, setChannelData] = useState<ChannelData[]>([]);
  const [expenseData, setExpenseData] = useState<CostCenterData[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  const [reconciliationData, setReconciliationData] = useState<
    ReconciliationSource[]
  >([]);
  const [recentTxData, setRecentTxData] = useState<RecentTransaction[]>([]);

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadKPIData = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;

      // Revenue this month
      let revenueQuery = supabase
        .from("invoices")
        .select("invoice_amount, is_reconciled, is_intercompany")
        .eq("invoice_type", "REVENUE")
        .gte("payment_date", monthStart)
        .lt("payment_date", monthEnd);

      if (selectedScope !== "GLOBAL") {
        revenueQuery = revenueQuery.eq("scope", selectedScope);
      }
      const { data: revenueInvoices } = await revenueQuery;
      const revenueMonth =
        revenueInvoices?.filter(i => !i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;
      const intercompanyRevenue =
        revenueInvoices?.filter(i => i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;

      // Expenses this month
      let expenseQuery = supabase
        .from("invoices")
        .select("invoice_amount, is_reconciled, is_intercompany")
        .eq("invoice_type", "INCURRED")
        .gte("payment_date", monthStart)
        .lt("payment_date", monthEnd);

      if (selectedScope !== "GLOBAL") {
        expenseQuery = expenseQuery.eq("scope", selectedScope);
      }
      const { data: expenseInvoices } = await expenseQuery;
      const expenseMonth =
        expenseInvoices?.filter(i => !i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;
      const intercompanyExpense =
        expenseInvoices?.filter(i => i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;

      // Reconciliation rate — all invoices
      let allQuery = supabase.from("invoices").select("is_reconciled");
      if (selectedScope !== "GLOBAL") {
        allQuery = allQuery.eq("scope", selectedScope);
      }
      const { data: allInvoices } = await allQuery;
      const total = allInvoices?.length || 0;
      const reconciled =
        allInvoices?.filter((i) => i.is_reconciled).length || 0;
      const reconciliationRate =
        total > 0 ? Math.round((reconciled / total) * 100) : 0;

      // Pending transactions from csv_rows
      const { count: pendingCount } = await supabase
        .from("csv_rows")
        .select("id", { count: "exact", head: true })
        .eq("reconciled", false);

      setKpiData({
        revenueMonth,
        expenseMonth,
        netResult: revenueMonth - expenseMonth,
        reconciliationRate,
        pendingTransactions: pendingCount || 0,
        totalBankBalance: 0, // updated by loadBankBalances
        intercompanyRevenue,
        intercompanyExpense,
        bankBalanceDate: "",
      });
    } catch (error) {
      console.error("Error loading KPIs:", error);
    }
  }, [selectedScope]);

  const loadCashFlow = useCallback(async () => {
    try {
      const months: CashFlowPoint[] = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;

        const [{ data: inflows }, { data: outflows }] = await Promise.all([
          supabase
            .from("invoices")
            .select("invoice_amount, is_intercompany")
            .eq("invoice_type", "REVENUE")
            .eq("is_reconciled", true)
            .gte("payment_date", `${monthKey}-01`)
            .lt("payment_date", `${nextKey}-01`),
          supabase
            .from("invoices")
            .select("invoice_amount, is_intercompany")
            .eq("invoice_type", "INCURRED")
            .eq("is_reconciled", true)
            .gte("payment_date", `${monthKey}-01`)
            .lt("payment_date", `${nextKey}-01`),
        ]);

        const inflow =
          inflows?.filter(i => !i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;
        const outflow =
          outflows?.filter(i => !i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;
        const icInflow =
          inflows?.filter(i => i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;
        const icOutflow =
          outflows?.filter(i => i.is_intercompany).reduce((s, i) => s + (i.invoice_amount || 0), 0) || 0;

        months.push({
          month: date.toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          }),
          inflow,
          outflow,
          net: inflow - outflow,
          icInflow,
          icOutflow,
        });
      }
      setCashFlowData(months);
    } catch (error) {
      console.error("Error loading cash flow:", error);
    }
  }, []);

  const loadChannelRevenue = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from("csv_rows")
        .select("source, amount")
        .in("source", [
          "braintree-eur",
          "braintree-usd",
          "braintree-gbp",
          "braintree-aud",
          "braintree-amex",
          "braintree-transactions",
          "stripe-eur",
          "stripe-usd",
          "stripe",
          "gocardless",
          "paypal",
        ]);

      const grouped: Record<string, number> = {};
      rows?.forEach((r) => {
        const src = (r.source || "").toLowerCase();
        let channel = "Outros";
        if (src.includes("braintree")) channel = "Braintree";
        else if (src.includes("stripe")) channel = "Stripe";
        else if (src.includes("gocardless")) channel = "GoCardless";
        else if (src.includes("paypal")) channel = "PayPal";

        const amount = Math.abs(r.amount || 0);
        grouped[channel] = (grouped[channel] || 0) + amount;
      });

      const result: ChannelData[] = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({
          name,
          value,
          color: CHANNEL_COLORS[name] || "#6b7280",
        }));

      setChannelData(result);
    } catch (error) {
      console.error("Error loading channel revenue:", error);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      let query = supabase
        .from("invoices")
        .select("cost_center_code, invoice_amount")
        .eq("invoice_type", "INCURRED")
        .not("cost_center_code", "is", null);

      if (selectedScope !== "GLOBAL") {
        query = query.eq("scope", selectedScope);
      }
      const { data: expenses } = await query;

      const grouped: Record<string, number> = {};
      expenses?.forEach((e) => {
        if (e.cost_center_code) {
          grouped[e.cost_center_code] =
            (grouped[e.cost_center_code] || 0) + (e.invoice_amount || 0);
        }
      });

      const sorted: CostCenterData[] = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));

      setExpenseData(sorted);
    } catch (error) {
      console.error("Error loading expenses:", error);
    }
  }, [selectedScope]);

  const loadBankBalances = useCallback(async () => {
    try {
      const bankSources = Object.keys(BANK_LABELS);
      const balances: BankBalance[] = [];
      let bankinterEurDate = "";

      await Promise.all(
        bankSources.map(async (source) => {
          const { data: rows } = await supabase
            .from("csv_rows")
            .select("date, amount, custom_data")
            .eq("source", source)
            .order("date", { ascending: false })
            .limit(1);

          if (rows && rows.length > 0) {
            const row = rows[0];
            const customData =
              typeof row.custom_data === "string"
                ? JSON.parse(row.custom_data)
                : row.custom_data;

            // Check both "saldo" (bankinter) and "balance" (chase, sabadell) fields
            let saldo: number;
            if (customData?.saldo !== undefined) {
              saldo = parseFloat(String(customData.saldo));
            } else if (customData?.balance !== undefined) {
              saldo = parseFloat(String(customData.balance));
            } else {
              saldo = row.amount || 0;
            }

            const info = BANK_LABELS[source];
            balances.push({
              bank: info.bank,
              currency: info.currency,
              balance: saldo,
              lastDate: row.date || "—",
              source,
            });

            // Track bankinter-eur reference date
            if (source === "bankinter-eur" && row.date) {
              bankinterEurDate = row.date;
            }
          }
        })
      );

      balances.sort((a, b) => a.bank.localeCompare(b.bank));
      setBankBalances(balances);

      const total = balances.reduce((s, b) => s + b.balance, 0);
      setKpiData((prev) => ({
        ...prev,
        totalBankBalance: total,
        bankBalanceDate: bankinterEurDate,
      }));
    } catch (error) {
      console.error("Error loading bank balances:", error);
    }
  }, []);

  const loadReconciliation = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from("csv_rows")
        .select("source, reconciled");

      if (!rows) return;

      const grouped: Record<string, { total: number; reconciled: number }> = {};
      rows.forEach((r) => {
        const src = r.source || "unknown";
        if (!grouped[src]) grouped[src] = { total: 0, reconciled: 0 };
        grouped[src].total++;
        if (r.reconciled) grouped[src].reconciled++;
      });

      const result: ReconciliationSource[] = Object.entries(grouped)
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 10)
        .map(([source, v]) => ({
          source,
          label: SOURCE_LABELS[source] || source,
          total: v.total,
          reconciled: v.reconciled,
          color: getSourceColor(source),
        }));

      setReconciliationData(result);
    } catch (error) {
      console.error("Error loading reconciliation:", error);
    }
  }, []);

  const loadRecentTransactions = useCallback(async () => {
    try {
      const { data: rows } = await supabase
        .from("csv_rows")
        .select(
          "id, date, description, amount, source, reconciled, custom_data"
        )
        .order("date", { ascending: false })
        .limit(10);

      if (!rows) return;

      const txs: RecentTransaction[] = rows.map((r) => {
        const src = (r.source || "").toLowerCase();
        let currency = "EUR";
        if (src.includes("usd")) currency = "USD";
        else if (src.includes("gbp")) currency = "GBP";
        else if (src.includes("aud")) currency = "AUD";

        return {
          id: r.id,
          date: r.date || "",
          description: r.description || "",
          amount: r.amount || 0,
          currency,
          source: r.source || "",
          reconciled: !!r.reconciled,
        };
      });

      setRecentTxData(txs);
    } catch (error) {
      console.error("Error loading recent transactions:", error);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Load all data on mount and scope change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([
          loadKPIData(),
          loadCashFlow(),
          loadChannelRevenue(),
          loadExpenses(),
          loadBankBalances(),
          loadReconciliation(),
          loadRecentTransactions(),
        ]);
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [
    selectedScope,
    loadKPIData,
    loadCashFlow,
    loadChannelRevenue,
    loadExpenses,
    loadBankBalances,
    loadReconciliation,
    loadRecentTransactions,
  ]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-bg px-6 py-6 space-y-6">
      {/* Header */}
      <DashboardHeader
        userName={profile?.name || "Utilizador"}
        scope={selectedScope}
      />

      {/* KPI Strip */}
      <KPIStrip
        data={kpiData}
        showIntercompany={showIntercompany}
        onToggleIntercompany={() => setShowIntercompany((p) => !p)}
      />

      {/* Cash Flow Chart (full width) */}
      <CashFlowAreaChart data={cashFlowData} showIntercompany={showIntercompany} />

      {/* Revenue by Channel + Expense by Cost Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueByChannelChart data={channelData} />
        <ExpensesByCostCenter data={expenseData} />
      </div>

      {/* Bank Balances + Reconciliation Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BankBalancesCards data={bankBalances} />
        <ReconciliationStatus data={reconciliationData} />
      </div>

      {/* Recent Transactions */}
      <RecentTransactions data={recentTxData} />
    </div>
  );
}
