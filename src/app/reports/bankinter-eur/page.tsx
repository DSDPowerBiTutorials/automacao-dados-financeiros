'use client'

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

export default function BankinterEurPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (!supabase) {
      console.error("Supabase client not configured.");
      setData([]);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("csv_rows")
      .select("*")
      .eq("source", "bankinter-eur")
      .order("date", { ascending: false });

    if (error) {
      console.error("Erro ao carregar dados:", error);
    } else {
      setData(data || []);
    }
    setIsLoading(false);
  };

  // ✅ Corrigida apenas esta função, mantendo estrutura original
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!supabase) {
      console.error("Supabase client not configured.");
      return;
    }

    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsSaving(true);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const csv = XLSX.utils.sheet_to_csv(sheet);
      const fileName = `bankinter_eur_${Date.now()}.csv`;

      const { error: uploadError } = await supabase.storage
        .from("csv_files")
        .upload(fileName, new Blob([csv], { type: "text/csv" }), { upsert: true });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("csv_rows").insert(rows);
      if (insertError) throw insertError;

      alert(`✅ Arquivo ${file.name} processado e salvo com sucesso!`);
      await loadData();
    } catch (err) {
      console.error("Erro ao processar upload:", err);
      alert("❌ Erro ao processar o arquivo. Verifique o formato e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Bankinter EUR</CardTitle>
          <CardDescription>Upload e visualização de lançamentos em euros.</CardDescription>
        </CardHeader>
        <CardContent>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} />
          {isSaving && <p className="text-sm text-gray-500 mt-2">Processando arquivo...</p>}
          {isLoading ? (
            <p className="mt-4">Carregando...</p>
          ) : (
            <table className="mt-6 w-full border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">Data</th>
                  <th className="border p-2">Descrição</th>
                  <th className="border p-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-500">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="border p-2">{row.date || "-"}</td>
                      <td className="border p-2">{row.description || "-"}</td>
                      <td className="border p-2 text-right">
                        {parseFloat(row.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
