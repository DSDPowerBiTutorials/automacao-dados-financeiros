"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type {
  BankTransaction,
  Despesa,
} from "@/lib/supabase/queries/contas-a-pagar";

interface ConciliationTableProps {
  despesas: Despesa[];
  transactions: BankTransaction[];
  onMatch: (despesa: Despesa, transaction: BankTransaction) => Promise<void>;
}

export function ConciliationTable({
  despesas,
  transactions,
  onMatch,
}: ConciliationTableProps) {
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [isMatching, setIsMatching] = useState<string | null>(null);

  const transactionsByAccount = useMemo(() => {
    return transactions.reduce<Record<string, BankTransaction[]>>((acc, tx) => {
      const key = tx.bank_account || "sem-conta";
      acc[key] = acc[key] || [];
      acc[key].push(tx);
      return acc;
    }, {});
  }, [transactions]);

  const handleMatch = async (despesa: Despesa) => {
    const transactionId = selection[despesa.id];
    if (!transactionId) {
      alert("Selecione uma transação para conciliar.");
      return;
    }
    const transaction = transactions.find((tx) => tx.id === transactionId);
    if (!transaction) return;

    setIsMatching(despesa.id);
    try {
      await onMatch(despesa, transaction);
      setSelection((prev) => ({ ...prev, [despesa.id]: "" }));
    } catch (err) {
      console.error("❌ Erro ao conciliar:", err);
    } finally {
      setIsMatching(null);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle>Conciliação manual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {despesas.length === 0 && (
          <p className="text-gray-500 text-sm">
            Nenhuma despesa pendente de conciliação.
          </p>
        )}

        {despesas.map((despesa) => {
          const availableTransactions =
            transactionsByAccount[despesa.bank_account || "sem-conta"] ||
            transactions;
          return (
            <div
              key={despesa.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600">
                    {despesa.data_vencimento}
                  </p>
                  <p className="font-semibold text-gray-900">
                    {despesa.descricao}
                  </p>
                  <p className="text-sm text-gray-600">
                    {despesa.bank_account || "Sem conta"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Valor</p>
                  <p className="text-xl font-bold text-[#1a2b4a]">
                    {formatCurrency(Number(despesa.valor || 0))}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label>Transação bancária</Label>
                  <Select
                    value={selection[despesa.id] || ""}
                    onValueChange={(value) =>
                      setSelection((prev) => ({ ...prev, [despesa.id]: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a transação" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTransactions.map((tx) => (
                        <SelectItem key={tx.id} value={tx.id}>
                          {`${tx.date} • ${tx.description} • ${formatCurrency(Number(tx.amount || 0))}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-emerald-600 text-white"
                    disabled={isMatching === despesa.id}
                    onClick={() => handleMatch(despesa)}
                  >
                    {isMatching === despesa.id ? "Conciliando..." : "Match"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
