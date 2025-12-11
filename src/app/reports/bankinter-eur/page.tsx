"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  Loader2,
  Upload,
  ArrowLeft,
  Filter,
  X,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sidebar } from "@/components/custom/sidebar";
import { formatCurrency } from "@/lib/formatters";

interface BankinterEURRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  reference?: string | null;
  conciliado: boolean;
}

export default function BankinterEURPage() {
  const [rows, setRows] = useState<BankinterEURRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<BankinterEURRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, dateFrom, dateTo]);

  const loadData = async () => {
    setIsLoading(true);
<<<<<<< HEAD
=======
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
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "xlsx") {
      alert("❌ Apenas arquivos .xlsx são aceitos. Selecione um arquivo válido e tente novamente.");
      return;
    }

>>>>>>> ba3cae81 (fix: enforce xlsx upload conversion)
    try {
      const { data, error } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "bankinter-eur")
        .order("date", { ascending: false });

<<<<<<< HEAD
      if (error) throw error;

      const parsed =
        data?.map((r) => ({
          id: r.id,
          date: r.date,
          description: r.description,
          amount: parseFloat(r.amount),
          balance: r.balance,
          reference: r.reference,
          conciliado: r.custom_data?.conciliado ?? false,
        })) ?? [];
=======
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);

      const csvWorkbook = XLSX.read(csv, { type: "string" });
      const csvSheet = csvWorkbook.Sheets[csvWorkbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(csvSheet, { defval: "" });

      const fileName = `bankinter_eur_${Date.now()}.csv`;
>>>>>>> ba3cae81 (fix: enforce xlsx upload conversion)

      setRows(parsed);
    } catch (err) {
      console.error("❌ Error loading data:", err);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let f = rows;
    if (dateFrom) f = f.filter((r) => r.date >= dateFrom);
    if (dateTo) f = f.filter((r) => r.date <= dateTo);
    setFilteredRows(f);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isSupported = /\.(csv|xlsx|xls)$/i.test(file.name);
    if (!isSupported) {
      alert("❌ Apenas arquivos .csv ou .xlsx são aceitos.");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload-bankinter-eur", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Erro ao processar upload.");
      }

      alert(`✅ ${result.message || "Arquivo enviado com sucesso!"}`);
      await loadData();
      const now = new Date().toLocaleString();
      setLastSaved(now);
    } catch (err) {
      console.error("❌ Erro ao enviar arquivo Bankinter EUR:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Não foi possível processar o upload. Tente novamente.",
      );
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const { totalIncomes, unreconciled } = React.useMemo(() => {
    const totalIncomes = filteredRows
      .filter((r) => r.amount > 0)
      .reduce((a, b) => a + b.amount, 0);
    const unreconciled = filteredRows.filter((r) => !r.conciliado).length;
    return { totalIncomes, unreconciled };
  }, [filteredRows]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7300]" />
      </div>
    );
  }

  return (
<<<<<<< HEAD
    <div className="min-h-screen bg-white">
      <Sidebar currentPage="bankinter-eur" paymentSourceDates={{}} />

      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-black">
                    Bankinter EUR – Bank Statement
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredRows.length} records
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  id="bankinter-upload"
                  onChange={handleUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-black text-black hover:bg-gray-100"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload XLSX
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <Filter className="h-4 w-4 text-gray-600" />
              <span className="text-sm font-medium text-gray-700">
                Date Filters:
              </span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">From:</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">To:</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>

            {lastSaved && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 font-medium">
                  ✅ Last updated: {lastSaved}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Incomes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalIncomes)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Unreconciled Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {unreconciled}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-xl border-2 border-gray-200">
            <CardHeader className="bg-[#FF7300] text-white">
              <CardTitle className="text-white">
                Bank Statement Details
              </CardTitle>
              <CardDescription className="text-white/90">
                Imported data from Supabase (Bankinter EUR)
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">
                        Date
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">
                        Description
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">
                        Amount
                      </th>
=======
    <div className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>Bankinter EUR</CardTitle>
          <CardDescription>Upload e visualização de lançamentos em euros.</CardDescription>
        </CardHeader>
        <CardContent>
          <input type="file" accept=".xlsx" onChange={handleFileUpload} />
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
>>>>>>> ba3cae81 (fix: enforce xlsx upload conversion)
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available. Upload an XLSX file to begin.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-gray-200 hover:bg-gray-50"
                        >
                          <td className="py-3 px-4 text-sm text-black">
                            {r.date}
                          </td>
                          <td className="py-3 px-4 text-sm text-black">
                            {r.description}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-bold text-[#FF7300]">
                            {formatCurrency(r.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
