"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Sidebar } from "@/components/custom/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ContaGerencial,
  Despesa,
  Fornecedor,
  listContasGerenciais,
  listDespesas,
  listFornecedores,
  upsertDespesa,
} from "@/lib/supabase/queries/contas-a-pagar";
import { LayoutTabs } from "../components/LayoutTabs";
import { DespesaForm } from "../components/DespesaForm";
import { TabelaDespesas } from "../components/TabelaDespesas";

export default function DespesasPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contas, setContas] = useState<ContaGerencial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Despesa | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [d, f, c] = await Promise.all([
        listDespesas(),
        listFornecedores(),
        listContasGerenciais(),
      ]);
      setDespesas(d);
      setFornecedores(f);
      setContas(c);
    } catch (err) {
      console.error("❌ Erro ao carregar dados de despesas:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (payload: Partial<Despesa>) => {
    const saved = await upsertDespesa(payload);
    if (saved) {
      alert("✅ Despesa salva com sucesso!");
      setDialogOpen(false);
      setSelected(null);
      await loadData();
    } else {
      alert("❌ Não foi possível salvar a despesa.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar currentPage="contas-a-pagar" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Despesas</h1>
              <p className="text-sm text-gray-600 mt-1">
                Cadastre e edite despesas vinculadas a fornecedores e contas gerenciais
              </p>
            </div>
            <Button
              className="bg-[#1a2b4a] text-white gap-2"
              onClick={() => {
                setSelected(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Nova despesa
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-6 py-8 space-y-6">
          <LayoutTabs />

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF7300]" />
            </div>
          ) : (
            <TabelaDespesas despesas={despesas} onEdit={(d) => {
              setSelected(d);
              setDialogOpen(true);
            }} />
          )}
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          </DialogHeader>
          <DespesaForm
            initialData={selected ?? undefined}
            fornecedores={fornecedores}
            contas={contas}
            onSave={handleSave}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
