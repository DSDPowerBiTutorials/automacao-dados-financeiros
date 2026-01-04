"use client";

import { useState, useEffect } from "react";
import { CreditCard, TrendingUp, DollarSign, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatCurrency } from "@/lib/formatters";
import BraintreeApiSync from "@/components/braintree/api-sync-button";

interface CurrencyStats {
  currency: string;
  total_transactions: number;
  total_revenue: number;
  total_fees: number;
  net_amount: number;
  last_transaction: string | null;
  reconciled_count: number;
  pending_count: number;
}

const CURRENCY_INFO = {
  EUR: { symbol: "€", name: "Euros", color: "from-blue-500 to-blue-600", flag: "🇪🇺" },
  USD: { symbol: "$", name: "US Dollars", color: "from-green-500 to-green-600", flag: "🇺🇸" },
  GBP: { symbol: "£", name: "British Pounds", color: "from-purple-500 to-purple-600", flag: "🇬🇧" },
  AUD: { symbol: "A$", name: "Australian Dollars", color: "from-orange-500 to-orange-600", flag: "🇦🇺" },
};

export default function BraintreeDashboard() {
  const [stats, setStats] = useState<CurrencyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    loadStats();

    // ✅ Escutar mudanças em tempo real do Supabase
    const subscription = supabase
      .channel('braintree_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Qualquer evento (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'csv_rows',
          filter: 'source=in.(braintree-api-revenue,braintree-api-fees,braintree-api-disbursement)',
        },
        (payload) => {
          console.log('[Realtime] Mudança detectada em Braintree:', payload);
          // Recarregar stats quando houver mudança
          loadStats();
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Status da inscrição Braintree: ${status}`);
      });

    // Cleanup ao desmontar
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        console.warn("Supabase not configured");
        return;
      }

      // Buscar todas as transações de revenue
      const { data: revenueData, error: revenueError } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "braintree-api-revenue");

      if (revenueError) {
        console.error("Error loading revenue:", revenueError);
        return;
      }

      // Buscar todas as fees
      const { data: feesData, error: feesError } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "braintree-api-fees");

      if (feesError) {
        console.error("Error loading fees:", feesError);
        return;
      }

      // Agrupar por moeda
      const currencyMap: { [key: string]: CurrencyStats } = {};

      // Processar revenue
      revenueData?.forEach((row) => {
        const currency = row.custom_data?.currency || "EUR";
        if (!currencyMap[currency]) {
          currencyMap[currency] = {
            currency,
            total_transactions: 0,
            total_revenue: 0,
            total_fees: 0,
            net_amount: 0,
            last_transaction: null,
            reconciled_count: 0,
            pending_count: 0,
          };
        }

        currencyMap[currency].total_transactions++;
        currencyMap[currency].total_revenue += parseFloat(row.amount) || 0;

        if (row.reconciled) {
          currencyMap[currency].reconciled_count++;
        } else {
          currencyMap[currency].pending_count++;
        }

        // Atualizar última transação
        if (!currencyMap[currency].last_transaction || row.date > currencyMap[currency].last_transaction!) {
          currencyMap[currency].last_transaction = row.date;
        }
      });

      // Processar fees
      feesData?.forEach((row) => {
        const currency = row.custom_data?.currency || "EUR";
        if (currencyMap[currency]) {
          currencyMap[currency].total_fees += Math.abs(parseFloat(row.amount) || 0);
        }
      });

      // Calcular net amount
      Object.values(currencyMap).forEach((stat) => {
        stat.net_amount = stat.total_revenue - stat.total_fees;
      });

      const statsArray = Object.values(currencyMap).sort((a, b) => b.total_revenue - a.total_revenue);
      setStats(statsArray);

      // Calcular volume total (convertendo tudo para EUR simplificadamente)
      const total = statsArray.reduce((sum, stat) => sum + stat.total_revenue, 0);
      setTotalVolume(total);

    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrencyRoute = (currency: string): string => {
    return `/reports/braintree-${currency.toLowerCase()}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Braintree Multi-Currency Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Consolidated view across all payment currencies
          </p>
        </div>
        <BraintreeApiSync onSyncComplete={loadStats} />
      </div>

      {/* Total Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium opacity-90">Total Currencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.length}</div>
            <p className="text-xs opacity-75 mt-1">Active payment sources</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium opacity-90">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.reduce((sum, s) => sum + s.total_transactions, 0).toLocaleString()}
            </div>
            <p className="text-xs opacity-75 mt-1">Across all currencies</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium opacity-90">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalVolume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs opacity-75 mt-1">Combined across currencies</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium opacity-90">Pending Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.reduce((sum, s) => sum + s.pending_count, 0).toLocaleString()}
            </div>
            <p className="text-xs opacity-75 mt-1">Items to reconcile</p>
          </CardContent>
        </Card>
      </div>

      {/* Currency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((stat) => {
          const info = CURRENCY_INFO[stat.currency as keyof typeof CURRENCY_INFO] || {
            symbol: stat.currency,
            name: stat.currency,
            color: "from-gray-500 to-gray-600",
            flag: "💱",
          };

          return (
            <Card key={stat.currency} className="hover:shadow-lg transition-shadow">
              <CardHeader className={`bg-gradient-to-r ${info.color} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">{info.flag}</span>
                    <div>
                      <CardTitle className="text-2xl">{stat.currency}</CardTitle>
                      <CardDescription className="text-white/90">{info.name}</CardDescription>
                    </div>
                  </div>
                  <CreditCard className="h-8 w-8 opacity-75" />
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Transactions</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {stat.total_transactions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Revenue</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(stat.total_revenue, stat.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Fees</p>
                      <p className="text-lg font-semibold text-red-600">
                        -{formatCurrency(stat.total_fees, stat.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Net Amount</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCurrency(stat.net_amount, stat.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Reconciliation Status */}
                  <div className="flex items-center justify-between py-3 border-t">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-gray-600">
                          Reconciled: <strong>{stat.reconciled_count}</strong>
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-gray-600">
                          Pending: <strong>{stat.pending_count}</strong>
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Last Transaction */}
                  {stat.last_transaction && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 border-t pt-3">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Last transaction:{" "}
                        <strong>{new Date(stat.last_transaction).toLocaleDateString()}</strong>
                      </span>
                    </div>
                  )}

                  {/* View Details Button */}
                  <Link href={getCurrencyRoute(stat.currency)}>
                    <Button className="w-full" variant="outline">
                      View {stat.currency} Transactions
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {stats.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
            <p className="text-gray-600 mb-4">
              Start by syncing transactions from Braintree API
            </p>
            <BraintreeApiSync onSyncComplete={loadStats} />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/reports/braintree-eur">
              <Button variant="outline" className="w-full">
                🇪🇺 EUR Transactions
              </Button>
            </Link>
            <Link href="/reports/braintree-usd">
              <Button variant="outline" className="w-full">
                🇺🇸 USD Transactions
              </Button>
            </Link>
            <Link href="/reports/braintree-gbp">
              <Button variant="outline" className="w-full">
                🇬🇧 GBP Transactions
              </Button>
            </Link>
            <Link href="/reports/braintree-aud">
              <Button variant="outline" className="w-full">
                🇦🇺 AUD Transactions
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
