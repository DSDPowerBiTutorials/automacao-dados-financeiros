"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type {
  Despesa,
  DespesaStatus,
} from "@/lib/supabase/queries/contas-a-pagar";

interface TabelaDespesasProps {
  despesas: Despesa[];
  onEdit: (despesa: Despesa) => void;
}

const statusColors: Record<DespesaStatus, string> = {
  Pending: "bg-amber-100 text-amber-800",
  Incurred: "bg-blue-100 text-blue-800",
  Paid: "bg-emerald-100 text-emerald-800",
};

export function TabelaDespesas({ despesas, onEdit }: TabelaDespesasProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DespesaStatus | "all">(
    "all",
  );

  const filtered = useMemo(() => {
    return despesas.filter((despesa) => {
      const matchesSearch =
        !search ||
        (despesa.descricao || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (despesa.bank_account || "")
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || despesa.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [despesas, search, statusFilter]);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Despesas</CardTitle>
        <div className="flex gap-2 items-center w-full md:w-auto">
          <Input
            placeholder="Buscar por descrição ou conta"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as DespesaStatus | "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Incurred">Incurred</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              <th className="py-2">Data</th>
              <th className="py-2">Descrição</th>
              <th className="py-2">Fornecedor</th>
              <th className="py-2">Conta</th>
              <th className="py-2">Valor</th>
              <th className="py-2">Status</th>
              <th className="py-2">Bank Account</th>
              <th className="py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((despesa) => (
              <tr key={despesa.id} className="border-b last:border-0">
                <td className="py-2 text-gray-700">
                  {despesa.data_vencimento || "-"}
                </td>
                <td className="py-2 font-medium text-gray-900">
                  {despesa.descricao || "-"}
                </td>
                <td className="py-2 text-gray-700">
                  {despesa.fornecedores?.nome || "-"}
                </td>
                <td className="py-2 text-gray-700">
                  {despesa.contas_gerenciais?.descricao || "-"}
                </td>
                <td className="py-2 text-gray-900 font-semibold">
                  {formatCurrency(Number(despesa.valor || 0))}
                </td>
                <td className="py-2">
                  <Badge className={statusColors[despesa.status] || ""}>
                    {despesa.status}
                  </Badge>
                </td>
                <td className="py-2 text-gray-700">{despesa.bank_account || "-"}</td>
                <td className="py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(despesa)}
                    className="text-[#1a2b4a]"
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nenhuma despesa encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
