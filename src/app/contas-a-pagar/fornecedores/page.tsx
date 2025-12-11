"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Sidebar } from "@/components/custom/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Fornecedor } from "@/lib/supabase/queries/contas-a-pagar";
import {
  listFornecedores,
  upsertFornecedor,
} from "@/lib/supabase/queries/contas-a-pagar";
import { LayoutTabs } from "../components/LayoutTabs";
import { FornecedorForm } from "../components/FornecedorForm";

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Fornecedor | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await listFornecedores();
      setFornecedores(data);
    } catch (err) {
      console.error("❌ Erro ao carregar fornecedores:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (payload: Partial<Fornecedor>) => {
    const saved = await upsertFornecedor(payload);
    if (saved) {
      alert("✅ Fornecedor salvo!");
      setSelected(null);
      setDialogOpen(false);
      await load();
    } else {
      alert("❌ Não foi possível salvar o fornecedor.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar currentPage="contas-a-pagar" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-black">Fornecedores</h1>
              <p className="text-sm text-gray-600 mt-1">
                Gerencie fornecedores e contatos
              </p>
            </div>
            <Button
              className="bg-[#1a2b4a] text-white gap-2"
              onClick={() => {
                setSelected(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Novo fornecedor
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
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Lista de fornecedores</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-2">Nome</th>
                      <th className="py-2">CNPJ</th>
                      <th className="py-2">Email</th>
                      <th className="py-2">Telefone</th>
                      <th className="py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fornecedores.map((fornecedor) => (
                      <tr
                        key={fornecedor.id}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 font-semibold text-gray-900">
                          {fornecedor.nome}
                        </td>
                        <td className="py-2 text-gray-700">
                          {fornecedor.cnpj || "-"}
                        </td>
                        <td className="py-2 text-gray-700">
                          {fornecedor.email || "-"}
                        </td>
                        <td className="py-2 text-gray-700">
                          {fornecedor.telefone || "-"}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelected(fornecedor);
                              setDialogOpen(true);
                            }}
                            className="text-[#1a2b4a]"
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <FornecedorForm
            initialData={selected ?? undefined}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
