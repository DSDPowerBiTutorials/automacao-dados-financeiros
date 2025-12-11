"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ContaGerencial,
  Despesa,
  DespesaStatus,
  Fornecedor,
} from "@/lib/supabase/queries/contas-a-pagar";

interface DespesaFormProps {
  initialData?: Partial<Despesa>;
  fornecedores: Fornecedor[];
  contas: ContaGerencial[];
  onSave: (payload: Partial<Despesa>) => Promise<void>;
  onCancel?: () => void;
}

const statuses: DespesaStatus[] = ["Pending", "Incurred", "Paid"];

export function DespesaForm({
  initialData,
  fornecedores,
  contas,
  onSave,
  onCancel,
}: DespesaFormProps) {
  const [form, setForm] = useState<Partial<Despesa>>({
    id: initialData?.id,
    data_vencimento: initialData?.data_vencimento ?? "",
    descricao: initialData?.descricao ?? "",
    valor: initialData?.valor ?? 0,
    fornecedor_id: initialData?.fornecedor_id ?? "",
    conta_gerencial_id: initialData?.conta_gerencial_id ?? "",
    status: initialData?.status ?? "Pending",
    bank_account: initialData?.bank_account ?? "",
    conciliated: initialData?.conciliated ?? false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof Despesa, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      console.error("❌ Erro ao salvar despesa:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_vencimento">Data de vencimento</Label>
          <Input
            id="data_vencimento"
            type="date"
            value={form.data_vencimento ?? ""}
            onChange={(e) => handleChange("data_vencimento", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            value={form.descricao ?? ""}
            onChange={(e) => handleChange("descricao", e.target.value)}
            placeholder="Descrição da despesa"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="valor">Valor</Label>
          <Input
            id="valor"
            type="number"
            step="0.01"
            value={form.valor ?? 0}
            onChange={(e) => handleChange("valor", Number(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={form.status}
            onValueChange={(value) =>
              handleChange("status", value as DespesaStatus)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_account">Bank Account</Label>
          <Input
            id="bank_account"
            value={form.bank_account ?? ""}
            onChange={(e) => handleChange("bank_account", e.target.value)}
            placeholder="Número da conta"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="fornecedor_id">Fornecedor</Label>
          <Select
            value={form.fornecedor_id ?? ""}
            onValueChange={(value) => handleChange("fornecedor_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {fornecedores.map((fornecedor) => (
                <SelectItem key={fornecedor.id} value={fornecedor.id}>
                  {fornecedor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="conta_gerencial_id">Conta Gerencial</Label>
          <Select
            value={form.conta_gerencial_id ?? ""}
            onValueChange={(value) => handleChange("conta_gerencial_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              {contas.map((conta) => (
                <SelectItem key={conta.id} value={conta.id}>
                  {conta.descricao || conta.codigo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          className="bg-[#1a2b4a] text-white"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
