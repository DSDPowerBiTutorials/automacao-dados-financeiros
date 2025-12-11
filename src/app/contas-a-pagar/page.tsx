"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/custom/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutTabs } from "./components/LayoutTabs";
import { OverviewCards } from "./components/OverviewCards";
import type { OverviewMetrics } from "@/lib/supabase/queries/contas-a-pagar";
import { getOverviewMetrics } from "@/lib/supabase/queries/contas-a-pagar";

export default function ContasAPagarPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await getOverviewMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("❌ Erro ao carregar métricas de contas a pagar:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Sidebar currentPage="contas-a-pagar" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-black">
                    Contas a Pagar
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    Overview, despesas, fornecedores e conciliação bancária
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8 space-y-6">
          <LayoutTabs />

          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF7300]" />
            </div>
          )}

          {!isLoading && metrics && <OverviewCards metrics={metrics} />}

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Módulos disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-gray-700">
              <p>• Despesas com status e contas gerenciais</p>
              <p>• Fornecedores com contatos</p>
              <p>• Conciliação com transações bancárias</p>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
