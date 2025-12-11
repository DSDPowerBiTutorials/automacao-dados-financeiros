"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Fornecedor } from "@/lib/supabase/queries/contas-a-pagar";

interface FornecedorFormProps {
  initialData?: Partial<Fornecedor>;
  onSave: (payload: Partial<Fornecedor>) => Promise<void>;
}

export function FornecedorForm({ initialData, onSave }: FornecedorFormProps) {
  const [form, setForm] = useState<Partial<Fornecedor>>({
    id: initialData?.id,
    nome: initialData?.nome ?? "",
    cnpj: initialData?.cnpj ?? "",
    email: initialData?.email ?? "",
    telefone: initialData?.telefone ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof Fornecedor, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      console.error("❌ Erro ao salvar fornecedor:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={form.nome ?? ""}
            onChange={(e) => handleChange("nome", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            value={form.cnpj ?? ""}
            onChange={(e) => handleChange("cnpj", e.target.value)}
            placeholder="00.000.000/0000-00"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email ?? ""}
            onChange={(e) => handleChange("email", e.target.value)}
            placeholder="contato@empresa.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={form.telefone ?? ""}
            onChange={(e) => handleChange("telefone", e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving} className="bg-[#1a2b4a] text-white">
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
