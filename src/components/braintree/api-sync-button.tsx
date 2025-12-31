/**
 * Componente: Botão de Sincronização Braintree API
 * 
 * Adiciona botão para sincronizar transações diretamente da API do Braintree
 * para o formato csv_rows compatível com o sistema existente.
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SyncResult {
  success: boolean;
  message?: string;
  data?: {
    transactions_processed: number;
    revenue_rows_inserted: number;
    fee_rows_inserted: number;
    total_revenue: number;
    total_fees: number;
    net_amount: number;
  };
  error?: string;
}

export default function BraintreeApiSync() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  // Período padrão: último mês
  const getDefaultDates = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDates());

  const handleSync = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/braintree/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          currency: "EUR", // Você pode adicionar selector de moeda se necessário
        }),
      });

      const data = await response.json();
      setResult(data);

      // Se sucesso, recarrega a página após 2 segundos
      if (data.success && data.data?.transactions_processed > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || "Erro ao sincronizar transações",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="h-4 w-4" />
          Sincronizar API Braintree
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Sincronizar Transações do Braintree</DialogTitle>
          <DialogDescription>
            Busca transações diretamente da API do Braintree e salva no sistema.
            As transações serão divididas em receitas (Contas a Receber) e fees
            (Contas a Pagar).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                disabled={isLoading}
              />
            </div>
          </div>

          {result && (
            <Alert
              variant={result.success ? "default" : "destructive"}
              className="mt-4"
            >
              {result.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.success ? (
                  <div className="space-y-2">
                    <p className="font-medium">{result.message}</p>
                    {result.data && (
                      <div className="text-sm space-y-1">
                        <p>
                          ✅ {result.data.transactions_processed} transações
                          processadas
                        </p>
                        <p>
                          💰 Receita: €
                          {result.data.total_revenue.toFixed(2)}
                        </p>
                        <p>
                          💸 Fees: €{result.data.total_fees.toFixed(2)}
                        </p>
                        <p className="font-medium">
                          📊 Líquido: €{result.data.net_amount.toFixed(2)}
                        </p>
                        {result.data.transactions_processed > 0 && (
                          <p className="text-muted-foreground mt-2">
                            Recarregando página...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{result.error || "Erro desconhecido"}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Fechar
          </Button>
          <Button onClick={handleSync} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Sincronizar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
