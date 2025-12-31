"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Loader2, ArrowRight, Building2, Shield } from "lucide-react";
import { useGlobalScope } from "@/contexts/global-scope-context";
import { useAuth } from "@/contexts/auth-context";
import { OverviewCards } from "@/components/dashboard/OverviewCards";
import { CashFlowChart } from "@/components/dashboard/CashFlowChart";
import { ExpenseChart } from "@/components/dashboard/ExpenseChart";
import { VendorChart } from "@/components/dashboard/VendorChart";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { selectedScope } = useGlobalScope();
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Overview data
  const [overviewData, setOverviewData] = useState({
    totalPayables: 0,
    totalReceivables: 0,
    reconciledPercentage: 0,
    activeEntities: 2,
    activeUsers: 0,
    lastSync: new Date().toISOString(),
  });

  // Cash flow data
  const [cashFlowData, setCashFlowData] = useState<Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>>([]);

  // Expense breakdown data
  const [expenseData, setExpenseData] = useState<Array<{
    name: string;
    value: number;
  }>>([]);

  // Top vendors data
  const [vendorData, setVendorData] = useState<Array<{
    name: string;
    amount: number;
  }>>([]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedScope]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOverviewStats(),
        loadCashFlowData(),
        loadExpenseData(),
        loadVendorData(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewStats = async () => {
    try {
      // Get total payables (AP invoices)
      const { data: apInvoices } = await supabase
        .from('invoices')
        .select('invoice_amount, is_reconciled')
        .eq('invoice_type', 'INCURRED')
        .eq('scope', selectedScope === 'GLOBAL' ? selectedScope : selectedScope);

      const totalPayables = apInvoices?.reduce((sum, inv) => sum + inv.invoice_amount, 0) || 0;

      // Get total receivables (AR invoices)
      const { data: arInvoices } = await supabase
        .from('invoices')
        .select('invoice_amount, is_reconciled')
        .eq('invoice_type', 'REVENUE')
        .eq('scope', selectedScope === 'GLOBAL' ? selectedScope : selectedScope);

      const totalReceivables = arInvoices?.reduce((sum, inv) => sum + inv.invoice_amount, 0) || 0;

      // Calculate reconciliation percentage
      const allInvoices = [...(apInvoices || []), ...(arInvoices || [])];
      const reconciledCount = allInvoices.filter(inv => inv.is_reconciled).length;
      const reconciledPercentage = allInvoices.length > 0
        ? Math.round((reconciledCount / allInvoices.length) * 100)
        : 0;

      // Get active users count
      const { count: userCount } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      setOverviewData({
        totalPayables,
        totalReceivables,
        reconciledPercentage,
        activeEntities: 2, // ES and US
        activeUsers: userCount || 0,
        lastSync: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error loading overview stats:', error);
    }
  };

  const loadCashFlowData = async () => {
    try {
      // Get last 12 months of cash flow
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
        
        // Calculate next month for the lt filter
        const nextMonth = new Date(date);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthKey = nextMonth.toISOString().substring(0, 7);

        // Get inflows (receivables paid)
        const { data: inflows } = await supabase
          .from('invoices')
          .select('invoice_amount')
          .eq('invoice_type', 'REVENUE')
          .eq('is_reconciled', true)
          .gte('payment_date', `${monthKey}-01`)
          .lt('payment_date', `${nextMonthKey}-01`);

        // Get outflows (payables paid)
        const { data: outflows } = await supabase
          .from('invoices')
          .select('invoice_amount')
          .eq('invoice_type', 'INCURRED')
          .eq('is_reconciled', true)
          .gte('payment_date', `${monthKey}-01`)
          .lt('payment_date', `${nextMonthKey}-01`);

        const inflow = inflows?.reduce((sum, inv) => sum + inv.invoice_amount, 0) || 0;
        const outflow = outflows?.reduce((sum, inv) => sum + inv.invoice_amount, 0) || 0;

        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          inflow,
          outflow,
          net: inflow - outflow,
        });
      }

      setCashFlowData(months);
    } catch (error) {
      console.error('Error loading cash flow data:', error);
    }
  };

  const loadExpenseData = async () => {
    try {
      const { data: expenses } = await supabase
        .from('invoices')
        .select('cost_center_code, invoice_amount')
        .eq('invoice_type', 'INCURRED')
        .not('cost_center_code', 'is', null);

      // Group by cost center
      const grouped: Record<string, number> = {};
      expenses?.forEach(exp => {
        if (exp.cost_center_code) {
          grouped[exp.cost_center_code] = (grouped[exp.cost_center_code] || 0) + exp.invoice_amount;
        }
      });

      // Get top 8 cost centers
      const sorted = Object.entries(grouped)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name, value }));

      setExpenseData(sorted);
    } catch (error) {
      console.error('Error loading expense data:', error);
    }
  };

  const loadVendorData = async () => {
    try {
      const { data: vendors } = await supabase
        .from('invoices')
        .select('provider_code, invoice_amount, providers(name)')
        .eq('invoice_type', 'INCURRED')
        .not('provider_code', 'is', null);

      // Group by provider
      const grouped: Record<string, { name: string; amount: number }> = {};
      vendors?.forEach(vendor => {
        if (vendor.provider_code) {
          if (!grouped[vendor.provider_code]) {
            grouped[vendor.provider_code] = {
              name: (vendor.providers as any)?.name || vendor.provider_code,
              amount: 0,
            };
          }
          grouped[vendor.provider_code].amount += vendor.invoice_amount;
        }
      });

      // Get top 10 vendors
      const sorted = Object.values(grouped)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      setVendorData(sorted);
    } catch (error) {
      console.error('Error loading vendor data:', error);
    }
  };

  const quickActions = [
    {
      title: 'Accounts Payable',
      description: 'Manage invoices and payments',
      href: '/accounts-payable/invoices',
      icon: Building2,
    },
    {
      title: 'Accounts Receivable',
      description: 'Track revenues and customers',
      href: '/accounts-receivable/invoices',
      icon: Shield,
    },
    {
      title: 'Cash Management',
      description: 'Bank accounts and reconciliation',
      href: '/cash-management',
      icon: Building2,
    },
    {
      title: 'Reports',
      description: 'Financial analysis and insights',
      href: '/reports/bankinter-eur',
      icon: Shield,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#243140]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
      />

      {/* Institutional Header */}
      <div className="bg-gradient-to-r from-[#243140] to-[#1a2530] rounded-lg p-8 text-white shadow-lg">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">DSD Finance Hub</h1>
          <p className="text-lg text-gray-200 mb-4">
            Integrated Financial Management Platform — empowering global operations from Spain and USA
          </p>
          {profile && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Logged in as: <strong>{profile.name}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Scope: <strong>{selectedScope}</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Financial Overview</h2>
        <OverviewCards data={overviewData} />
      </div>

      {/* Cash Flow Chart */}
      <CashFlowChart data={cashFlowData} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseChart data={expenseData} />
        <VendorChart data={vendorData} />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                className="h-auto flex flex-col items-start p-6 hover:bg-gray-50 hover:border-[#243140] transition-all"
                onClick={() => router.push(action.href)}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <Icon className="w-5 h-5 text-[#243140]" />
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
