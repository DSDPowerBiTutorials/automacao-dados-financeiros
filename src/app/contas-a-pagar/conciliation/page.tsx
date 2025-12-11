"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/custom/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BankTransaction,
  Despesa,
  createConciliation,
  listBankTransactions,
  listExpensesForConciliation,
} from "@/lib/supabase/queries/contas-a-pagar";
import { LayoutTabs } from "../components/LayoutTabs";
import { ConciliationTable } from "../components/ConciliationTable";
import { formatCurrency } from "@/lib/formatters";

export default function ConciliationPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [d, t] = await Promise.all([
        listExpensesForConciliation(),
        listBankTransactions(accountFilter || undefined),
      ]);
      setDespesas(d);
      setTransactions(t);
    } catch (err) {
      console.error("❌ Erro ao carregar conciliação:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accountFilter]);

  const totalIncurred = useMemo(
    () => despesas.reduce((acc, d) => acc + Number(d.valor || 0), 0),
    [despesas],
  );

  const handleMatch = async (
    despesa: Despesa,
    transaction: BankTransaction,
  ) => {
    const ok = await createConciliation(despesa, transaction);
    if (ok) {
      alert("✅ Conciliação criada!");
      await loadData();
    } else {
      alert("❌ Não foi possível conciliar.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar currentPage="contas-a-pagar" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Conciliation</h1>
              <p className="text-sm text-gray-600 mt-1">
                Reconcile despesas incorridas com transações bancárias
              </p>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8 space-y-6">
          <LayoutTabs />

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-gray-800">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">Despesas incorridas</p>
                <p className="text-2xl font-bold text-[#1a2b4a]">
                  {despesas.length}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">Valor incorrido</p>
                <p className="text-2xl font-bold text-[#1a2b4a]">
                  {formatCurrency(totalIncurred)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600">Transações carregadas</p>
                <p className="text-2xl font-bold text-[#1a2b4a]">
                  {transactions.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Bank Account</p>
                <Input
                  placeholder="Filtrar transações por conta"
                  value={accountFilter}
                  onChange={(e) => setAccountFilter(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF7300]" />
            </div>
          ) : (
            <ConciliationTable
              despesas={despesas}
              transactions={transactions}
              onMatch={handleMatch}
            />
          )}
        </main>
      </div>
    </div>
  );
}
