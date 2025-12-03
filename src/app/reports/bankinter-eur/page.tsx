"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

interface BankinterEURRow {
  id: string;
  date: string;
  description: string;
  amount: number;
}

const parseDateToISO = (rawDate: string): string => {
  const [day, month, year] = rawDate.split(/[\/\-]/);
  if (!day || !month || !year) return "";

  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().split("T")[0];
};

const sanitizeDescription = (description: string): string =>
  description.replace(/"/g, "").trim();

export default function BankinterEurPage() {
  const [data, setData] = useState<BankinterEURRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    try {
      const { data: rows, error } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "bankinter-eur")
        .order("date", { ascending: false });

      if (error) {
        console.error("❌ Erro ao carregar dados:", error);
        setData([]);
        return;
      }

      const mappedRows =
        rows?.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
        })) || [];

      setData(mappedRows);
    } catch (err) {
      console.error("❌ Erro inesperado ao carregar dados:", err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (!["csv", "xlsx"].includes(fileExtension || "")) {
      alert("❌ Formato inválido. Envie um arquivo .csv ou .xlsx.");
      return;
    }

    setIsSaving(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
        defval: "",
      });
      const parsedRows: BankinterEURRow[] = [];

      jsonRows.forEach((row, index) => {
        const rawDate = String(row["FECHA VALOR"] || "").trim();
        const date = parseDateToISO(rawDate);
        const description = sanitizeDescription(
          String(row["DESCRIPCIÓN"] || ""),
        );

        const haber =
          parseFloat(String(row["HABER"] || "0").replace(",", ".")) || 0;
        const debe =
          parseFloat(String(row["DEBE"] || "0").replace(",", ".")) || 0;
        const amount = parseFloat((haber - debe).toFixed(2));

        if (!date || !description) {
          console.warn(
            `⚠️ Linha ${index + 1} ignorada: dados obrigatórios ausentes`,
            row,
          );
          return;
        }

        const id = `BANKINTER-EUR-${Date.now()}-${index}`;

        parsedRows.push({
          id,
          date,
          description,
          amount,
        });
      });

      if (parsedRows.length === 0) {
        alert("❌ Nenhuma linha válida encontrada no arquivo.");
        return;
      }

      const rowsToPersist = parsedRows.map((row) => ({
        id: row.id,
        file_name: "bankinter-eur.csv",
        source: "bankinter-eur",
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: "Other",
        classification: "Other",
        reconciled: false,
        custom_data: {
          id: row.id,
          source: "bankinter-eur",
          date: row.date,
          description: row.description,
          amount: row.amount,
          conciliado: false,
          paymentSource: null,
          reconciliationType: null,
        },
      }));

      console.log(
        `📤 Enviando ${rowsToPersist.length} linhas para persistência via API.`,
      );

      const response = await fetch("/api/csv-rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToPersist, source: "bankinter-eur" }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("❌ Erro ao salvar linhas via API:", result.error);
        alert(
          `❌ Erro ao salvar dados: ${result.error || "Erro desconhecido."}`,
        );
        return;
      }

      const csvContent = XLSX.utils.sheet_to_csv(sheet);
      const storageFileName = `bankinter-eur/bankinter-eur-${Date.now()}.csv`;

      const { error: uploadError } = await supabase.storage
        .from("csv_files")
        .upload(storageFileName, new Blob([csvContent], { type: "text/csv" }), {
          upsert: true,
        });

      if (uploadError) {
        console.error(
          "❌ Falha ao fazer upload do CSV para o bucket:",
          uploadError,
        );
        alert(
          "⚠️ Linhas salvas, mas falha ao enviar o arquivo CSV para o armazenamento.",
        );
      } else {
        console.log(
          `✅ Upload concluído: ${storageFileName} (${rowsToPersist.length} registros)`,
        );
        alert(`✅ Arquivo ${file.name} processado e salvo com sucesso!`);
      }

      await loadData();
    } catch (err) {
      console.error("❌ Erro ao processar upload:", err);
      alert(
        "❌ Erro ao processar o arquivo. Verifique o formato e tente novamente.",
      );
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  };

  return (
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Bankinter EUR</CardTitle>
          <CardDescription>
            Upload e visualização de lançamentos em euros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} />
          {isSaving && (
            <p className="text-sm text-gray-500 mt-2">Processando arquivo...</p>
          )}
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
                  data.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="border p-2">{row.date || "-"}</td>
                      <td className="border p-2">{row.description || "-"}</td>
                      <td className="border p-2 text-right">
                        {row.amount.toFixed(2)}
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
