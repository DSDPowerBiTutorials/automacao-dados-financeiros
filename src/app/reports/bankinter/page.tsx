"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Edit2,
  Save,
  X,
  Trash2,
  ArrowLeft,
  Loader2,
  Database,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  loadAllCSVFiles,
  saveCSVFile,
  updateCSVRow,
  deleteCSVRow,
} from "@/lib/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

interface BankinterRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  fecha_contable: string;
  fecha_valor: string;
  clave: string;
  referencia: string;
  categoria: string;
  descripcion: string;
  ref_12: string;
  ref_16: string;
  debe: number;
  haber: number;
  importe: number;
  saldo: number;
  [key: string]: any;
}

export default function BankinterPage() {
  const [rows, setRows] = useState<BankinterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BankinterRow>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await loadAllCSVFiles();
      const bankinterFile = data.find((f) => f.source === "bankinter");

      if (bankinterFile) {
        setRows(bankinterFile.rows as BankinterRow[]);
      } else {
        setRows([]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseEuropeanNumber = (value: string): number => {
    if (!value || value === "") return 0;
    // Remove espaços e substitui vírgula por ponto
    const cleaned = value.toString().replace(/\s/g, "").replace(",", ".");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        const text = e.target?.result as string;
        console.log("📄 Raw CSV content:", text.substring(0, 500));

        const lines = text.split("\n");
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^\"|\"$/g, ""));
        console.log("📋 Headers detected:", headers);

        const newRows: BankinterRow[] = [];
        let idCounter = rows.length + 1;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i]
            .split(",")
            .map((v) => v.trim().replace(/^\"|\"$/g, ""));
          const row: any = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          console.log("🔍 Processing row:", row);

          // Mapear colunas do CSV para nosso formato
          const fechaAmount = row["FECHA VALOR"] || row["FECHA_VALOR"] || "";
          const descripcion = row["DESCRIPCIÓN"] || row["DESCRIPCION"] || "";
          const haberStr = row["HABER"] || row["Haber"] || "0";

          // Converter HABER (formato europeu com vírgula)
          const haberValue = parseEuropeanNumber(haberStr);

          console.log("💰 HABER conversion:", {
            original: haberStr,
            converted: haberValue,
          });

          newRows.push({
            id: `BKTR-${String(idCounter).padStart(4, "0")}`,
            date: fechaAmount,
            description: descripcion,
            amount: haberValue,
            fecha_contable:
              row["FECHA CONTABLE"] || row["FECHA_CONTABLE"] || "",
            fecha_valor: fechaAmount,
            clave: row["CLAVE"] || "",
            referencia: row["REFERENCIA"] || "",
            categoria: row["CATEGORÍA"] || row["CATEGORIA"] || "",
            descripcion: descripcion,
            ref_12: row["REF. 12"] || "",
            ref_16: row["REF. 16"] || "",
            debe: parseEuropeanNumber(row["DEBE"] || "0"),
            haber: haberValue,
            importe: parseEuropeanNumber(row["IMPORTE"] || "0"),
            saldo: parseEuropeanNumber(row["SALDO"] || "0"),
            ...row,
          });
          idCounter++;
        }

        console.log("✅ Processed rows:", newRows);

        const updatedRows = [...rows, ...newRows];
        setRows(updatedRows);

        // Save no Supabase
        const totalAmount = updatedRows.reduce(
          (sum, row) => sum + row.amount,
          0,
        );
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

        await saveCSVFile({
          name: file.name,
          lastUpdated: formattedDate,
          rows: updatedRows,
          totalAmount: totalAmount,
          source: "bankinter",
        });
      };

      reader.readAsText(file);
    }
  };

  const startEditing = (row: BankinterRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    const updatedRows = rows.map((row) =>
      row.id === editingRow ? { ...row, ...editedData } : row,
    );
    setRows(updatedRows);

    const rowToUpdate = updatedRows.find((r) => r.id === editingRow);
    if (rowToUpdate) {
      await updateCSVRow(rowToUpdate as any);
    }

    setEditingRow(null);
    setEditedData({});
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this row?")) return;

    setIsDeleting(true);
    try {
      const result = await deleteCSVRow(rowId);
      if (result.success) {
        await loadData();
      } else {
        alert("Error deleting row. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting row:", error);
      alert("Error deleting row. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "⚠️ WARNING: This will DELETE ALL rows from Bankinter! Are you sure?",
      )
    )
      return;
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?"))
      return;

    setIsDeleting(true);
    try {
      for (const row of rows) {
        await deleteCSVRow(row.id);
      }

      await loadData();
      alert("✅ All rows deleted successfully!");
    } catch (error) {
      console.error("Error deleting all rows:", error);
      alert("Error deleting rows. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Description",
      "Amount",
      "Fecha Contable",
      "Fecha Amount",
      "Clave",
      "Referencia",
      "Categoria",
      "Debe",
      "Haber",
      "Importe",
      "Saldo",
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.date,
          `"${row.description}"`,
          row.amount,
          row.fecha_contable,
          row.fecha_valor,
          row.clave,
          row.referencia,
          row.categoria,
          row.debe,
          row.haber,
          row.importe,
          row.saldo,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bankinter-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white dark:bg-black">
      <PageHeader title="Bankinter GBP" subtitle={`${rows.length} records`}>
        <div className="flex gap-2">
          <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-bankinter" />
          <label htmlFor="file-upload-bankinter">
            <Button variant="outline" size="sm" className="gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111] hover:text-gray-900 dark:text-white" asChild>
              <span><Upload className="h-4 w-4" /> Upload</span>
            </Button>
          </label>
          <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111] hover:text-gray-900 dark:text-white">
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button onClick={handleDeleteAll} variant="outline" size="sm" className="gap-2 border-red-800 text-red-400 hover:bg-red-900/50" disabled={isDeleting || rows.length === 0}>
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete All
          </Button>
        </div>
      </PageHeader>

      {/* Stats Bar */}
      <div className="bg-gray-100 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Total:</span>
            <span className="text-gray-900 dark:text-white font-medium">{rows.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400">Balance:</span>
            <span className="text-[#4fc3f7] font-medium">£{rows.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Table Header */}
          <div className="flex items-center bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            <div className="w-[80px]">ID</div>
            <div className="w-[90px]">Date</div>
            <div className="flex-1">Description</div>
            <div className="w-[100px] text-right">Amount</div>
            <div className="w-[100px] text-right">Saldo</div>
            <div className="w-[80px] text-center">Actions</div>
          </div>

          {/* Table Rows */}
          {rows.map((row) => (
            <div key={row.id} className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-800/50 hover:bg-gray-100 dark:hover:bg-[#252627] text-sm">
              <div className="w-[80px] text-gray-700 dark:text-gray-300 font-mono text-xs">{row.id}</div>
              <div className="w-[90px] text-gray-700 dark:text-gray-300">{row.date}</div>
              <div className="flex-1 text-gray-600 dark:text-gray-200 truncate pr-4">{row.description}</div>
              <div className="w-[100px] text-right text-[#4fc3f7] font-medium">£{row.amount.toFixed(2)}</div>
              <div className="w-[100px] text-right text-gray-700 dark:text-gray-300">£{row.saldo.toFixed(2)}</div>
              <div className="w-[80px] flex justify-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => startEditing(row)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDeleteRow(row.id)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-900/30" disabled={isDeleting}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              No records found. Upload a CSV to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
