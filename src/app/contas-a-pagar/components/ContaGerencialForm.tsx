"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ContaGerencial } from "@/lib/supabase/queries/contas-a-pagar";

interface ContaGerencialFormProps {
  initialData?: Partial<ContaGerencial>;
  onSave: (payload: Partial<ContaGerencial>) => Promise<void>;
}

export function ContaGerencialForm({
  initialData,
  onSave,
}: ContaGerencialFormProps) {
  const [form, setForm] = useState<Partial<ContaGerencial>>({
    id: initialData?.id,
    codigo: initialData?.codigo ?? "",
    descricao: initialData?.descricao ?? "",
    grupo: initialData?.grupo ?? "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof ContaGerencial, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      console.error("❌ Erro ao salvar conta gerencial:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            value={form.codigo ?? ""}
            onChange={(e) => handleChange("codigo", e.target.value)}
            placeholder="Ex: 1001"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input
            id="descricao"
            value={form.descricao ?? ""}
            onChange={(e) => handleChange("descricao", e.target.value)}
            placeholder="Ex: Infraestrutura"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="grupo">Grupo</Label>
        <Input
          id="grupo"
          value={form.grupo ?? ""}
          onChange={(e) => handleChange("grupo", e.target.value)}
          placeholder="Ex: Operacional"
        />
      </div>

      <div className="flex justify-end">
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
