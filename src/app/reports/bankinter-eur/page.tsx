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

  const normalizeHeader = (value: string) =>
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase()
      .trim();

  const parseNumber = (value: string) => {
    const cleanValue = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(cleanValue);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatDate = (value: string) => {
    const parts = value.split(/[\/\-]/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const isoDate = new Date(Number(year), Number(month) - 1, Number(day)).toISOString();
      return isoDate.slice(0, 10);
    }
    return value;
  };

  // ✅ Corrigida apenas esta função, mantendo estrutura original
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setIsSaving(true);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.Workbook) {
        workbook.Workbook.Media = [];
      }

      workbook.SheetNames.forEach(name => {
        const sheetWithImages = workbook.Sheets[name];
        if (sheetWithImages && "!images" in sheetWithImages) {
          sheetWithImages["!images"] = [];
        }
      });

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "", raw: false });

      const trimmedRows = allRows.slice(5);
      const endIndex = trimmedRows.findIndex(row =>
        row.some(cell => typeof cell === "string" && cell.toUpperCase().includes("INFORMACIÓN DE INTERÉS"))
      );

      const dataSection = endIndex === -1 ? trimmedRows : trimmedRows.slice(0, endIndex);

      if (dataSection.length < 2) {
        alert("❌ Nenhuma linha válida encontrada no arquivo.");
        return;
      }

      const headers = dataSection[0].map(cell => (cell ?? "").toString().trim());
      const fechaValorIndex = headers.findIndex(header => {
        const normalized = normalizeHeader(header);
        return normalized.includes("FECHA") && normalized.includes("VALOR");
      });
      const descriptionIndex = headers.findIndex(header => {
        const normalized = normalizeHeader(header);
        return normalized.includes("DESCRIPCION") || normalized.includes("DESCRIPCIÓN") || normalized.includes("CONCEPTO");
      });
      const haberIndex = headers.findIndex(header => normalizeHeader(header) === "HABER");
      const debeIndex = headers.findIndex(header => normalizeHeader(header) === "DEBE");
      const saldoIndex = headers.findIndex(header => normalizeHeader(header).includes("SALDO"));
      const referenceIndex = headers.findIndex(header => normalizeHeader(header).includes("REFERENCIA"));

      if (fechaValorIndex === -1 || descriptionIndex === -1 || (haberIndex === -1 && debeIndex === -1)) {
        alert("❌ Colunas obrigatórias não encontradas. Certifique-se de que o arquivo contém FECHA VALOR, DESCRIPCIÓN/CONCEPTO, HABER e DEBE.");
        return;
      }

      const mappedRows = dataSection.slice(1).reduce((acc: any[], row, index) => {
        const dateValue = (row[fechaValorIndex] ?? "").toString().trim();
        const descriptionValue = (row[descriptionIndex] ?? "").toString().replace(/"/g, "").trim();
        const haberValue = (row[haberIndex] ?? "0").toString();
        const debeValue = (row[debeIndex] ?? "0").toString();
        const saldoValue = saldoIndex !== -1 ? (row[saldoIndex] ?? "0").toString() : "";
        const referenceValue = referenceIndex !== -1 ? (row[referenceIndex] ?? "").toString().trim() : "";

        if (!dateValue || !descriptionValue) return acc;

        const amount = parseNumber(haberValue) - parseNumber(debeValue);
        const balance = saldoValue ? parseNumber(saldoValue) : 0;

        acc.push({
          id: `BANKINTER-EUR-${Date.now()}-${index}`,
          date: formatDate(dateValue),
          description: descriptionValue,
          amount,
          balance,
          reference: referenceValue || null,
        });
        return acc;
      }, []);

      if (mappedRows.length === 0) {
        alert("❌ Nenhum dado processável encontrado após filtragem.");
        return;
      }

      const filteredSheet = XLSX.utils.aoa_to_sheet([headers, ...dataSection.slice(1)]);
      const csv = XLSX.utils.sheet_to_csv(filteredSheet);
      const fileName = `bankinter_eur_${Date.now()}.csv`;

      const { error: uploadError } = await supabase.storage
        .from("csv_files")
        .upload(fileName, new Blob([csv], { type: "text/csv" }), { upsert: true });

      if (uploadError) throw uploadError;

      const rowsToInsert = mappedRows.map(row => ({
        id: row.id,
        file_name: fileName,
        source: "bankinter-eur",
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: "Other",
        classification: "Other",
        reconciled: false,
        custom_data: {
          balance: row.balance,
          reference: row.reference,
          conciliado: false,
          paymentSource: null,
          reconciliationType: null,
        },
      }));

      const { error: insertError } = await supabase.from("csv_rows").insert(rowsToInsert);
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
