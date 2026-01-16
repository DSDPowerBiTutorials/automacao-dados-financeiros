"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Upload,
  Download,
  Edit2,
  Save,
  X,
  Trash2,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Database,
  Zap,
  User,
  Filter,
  Calendar,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { formatCurrency, formatTimestamp, formatDate, formatUSD } from "@/lib/formatters";

interface BankinterUSDRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  conciliado: boolean;
  paymentSource?: string | null;
  reconciliationType?: "automatic" | "manual" | null;
  [key: string]: any;
}

// Mapeamento de cores por fonte de pagamento
const paymentSourceColors: {
  [key: string]: { bg: string; text: string; border: string };
} = {
  "Braintree EUR": {
    bg: "bg-[#002991]/10",
    text: "text-[#002991]",
    border: "border-[#002991]/20",
  },
  "Braintree USD": {
    bg: "bg-[#002991]/10",
    text: "text-[#002991]",
    border: "border-[#002991]/20",
  },
  "Braintree Amex": {
    bg: "bg-[#002991]/10",
    text: "text-[#002991]",
    border: "border-[#002991]/20",
  },
  Stripe: {
    bg: "bg-[#B1ADFF]/20",
    text: "text-black",
    border: "border-[#B1ADFF]/40",
  },
  GoCardless: {
    bg: "bg-[#F1F252]/20",
    text: "text-black",
    border: "border-[#F1F252]/40",
  },
};

export default function BankinterUSDPage() {
  const [rows, setRows] = useState<BankinterUSDRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<BankinterUSDRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BankinterUSDRow>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, dateFrom, dateTo]);

  const applyFilters = () => {
    let filtered = rows;

    if (dateFrom) {
      filtered = filtered.filter((row) => row.date >= dateFrom);
    }

    if (dateTo) {
      filtered = filtered.filter((row) => row.date <= dateTo);
    }

    setFilteredRows(filtered);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        console.warn("Supabase not configured");
        setRows([]);
        return;
      }

      const { data: rowsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "bankinter-usd")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error loading data:", error);
        setRows([]);
      } else if (rowsData) {
        const mappedRows: BankinterUSDRow[] = rowsData.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          conciliado: row.custom_data?.conciliado || false,
          paymentSource: row.custom_data?.paymentSource || null,
          reconciliationType: row.custom_data?.reconciliationType || null,
        }));
        setRows(mappedRows);
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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\\n");

        console.log("=== BANKINTER USD CSV PROCESSING ===");
        console.log("Total lines:", lines.length);

        if (lines.length < 2) {
          alert("❌ File is empty or invalid");
          return;
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^\\"|\\"$/g, ""));
        console.log("Headers found:", headers);

        const fechaAmountIndex = headers.findIndex(
          (h) =>
            h.toUpperCase().replace(/[ÃÁ]/g, "A").includes("FECHA") &&
            h.toUpperCase().includes("VALOR"),
        );
        const descripcionIndex = headers.findIndex((h) =>
          h
            .toUpperCase()
            .replace(/[ÃÓÑ\\"]/g, "O")
            .includes("DESCRIPCI"),
        );
        const haberIndex = headers.findIndex(
          (h) => h.toUpperCase() === "HABER",
        );

        console.log("Column mapping:");
        console.log(
          "- FECHA VALOR index:",
          fechaAmountIndex,
          "→",
          headers[fechaAmountIndex],
        );
        console.log(
          "- DESCRIPCIÓN index:",
          descripcionIndex,
          "→",
          headers[descripcionIndex],
        );
        console.log("- HABER index:", haberIndex, "→", headers[haberIndex]);

        if (
          fechaAmountIndex === -1 ||
          descripcionIndex === -1 ||
          haberIndex === -1
        ) {
          alert(
            "❌ Required columns not found! Make sure the file has: FECHA VALOR, DESCRIPCIÓN, HABER",
          );
          console.error("Available columns:", headers);
          return;
        }

        const newRows: BankinterUSDRow[] = [];
        let processedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values: string[] = [];
          let currentValue = "";
          let insideQuotes = false;

          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];

            if (char === '\\"') {
              insideQuotes = !insideQuotes;
            } else if (char === "," && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = "";
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());

          const fechaAmount = (values[fechaAmountIndex] || "").trim();
          const descripcion = (values[descripcionIndex] || "").trim();
          const haberValue = (values[haberIndex] || "0").trim();

          let amountNumber = 0;
          if (haberValue) {
            const cleanValue = haberValue.replace(/\\s/g, "").replace(",", ".");

            amountNumber = parseFloat(cleanValue) || 0;
          }

          if (amountNumber === 0 && !descripcion) continue;

          const uniqueId = `BANKINTER-USD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          newRows.push({
            id: uniqueId,
            date: fechaAmount,
            description: descripcion,
            amount: amountNumber,
            conciliado: false,
            paymentSource: null,
            reconciliationType: null,
          });

          processedCount++;
        }

        console.log("Processing complete:", processedCount, "rows processed");

        if (newRows.length === 0) {
          alert("❌ No valid data found in file");
          return;
        }

        try {
          setIsSaving(true);

          const rowsToInsert = newRows.map((row) => ({
            id: row.id,
            file_name: "bankinter-usd.csv",
            source: "bankinter-usd",
            date: row.date,
            description: row.description,
            amount: row.amount.toString(),
            category: "Other",
            classification: "Other",
            reconciled: false,
            custom_data: {
              id: row.id,
              date: row.date,
              description: row.description,
              amount: row.amount,
              conciliado: row.conciliado,
              paymentSource: row.paymentSource,
              reconciliationType: row.reconciliationType,
            },
          }));

          const response = await fetch("/api/csv-rows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: rowsToInsert,
              source: "bankinter-usd",
            }),
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            console.error("Error saving to database:", result.error);
            alert(
              `❌ Error saving to database: ${result.error || "Unknown error"}`,
            );
            return;
          }

          const updatedRows = [...rows, ...newRows];
          setRows(updatedRows);

          const now = new Date();
          const formattedTime = formatTimestamp(now);
          setLastSaved(formattedTime);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);

          alert(
            `✅ File uploaded successfully! ${processedCount} rows saved to database.`,
          );
        } catch (error) {
          console.error("Error saving to database:", error);
          alert(
            "⚠️ Error saving to database. Please check your Supabase configuration.",
          );
        } finally {
          setIsSaving(false);
        }
      };

      reader.readAsText(file);
    }
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const rowsToInsert = rows.map((row) => ({
        id: row.id,
        file_name: "bankinter-usd.csv",
        source: "bankinter-usd",
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: "Other",
        classification: "Other",
        reconciled: false,
        custom_data: {
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          conciliado: row.conciliado,
          paymentSource: row.paymentSource,
          reconciliationType: row.reconciliationType,
        },
      }));

      const response = await fetch("/api/csv-rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert, source: "bankinter-usd" }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error updating database:", result.error);
        alert(`❌ Error updating database: ${result.error || "Unknown error"}`);
        return;
      }

      const now = new Date();
      const formattedTime = formatTimestamp(now);
      setLastSaved(formattedTime);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Error saving data. Please check your Supabase configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (row: BankinterUSDRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    const updatedRows = rows.map((row) =>
      row.id === editingRow
        ? { ...row, ...editedData, reconciliationType: "manual" as const }
        : row,
    );
    setRows(updatedRows);

    const rowToUpdate = updatedRows.find((r) => r.id === editingRow);
    if (rowToUpdate && supabase) {
      try {
        const { error } = await supabase
          .from("csv_rows")
          .update({
            date: rowToUpdate.date,
            description: rowToUpdate.description,
            amount: rowToUpdate.amount.toString(),
            custom_data: {
              id: rowToUpdate.id,
              date: rowToUpdate.date,
              description: rowToUpdate.description,
              amount: rowToUpdate.amount,
              conciliado: rowToUpdate.conciliado,
              paymentSource: rowToUpdate.paymentSource,
              reconciliationType: rowToUpdate.reconciliationType,
            },
          })
          .eq("id", rowToUpdate.id);

        if (error) {
          console.error("Error updating row:", error);
          alert(`❌ Error updating row: ${error.message}`);
        } else {
          const now = new Date();
          const formattedTime = formatTimestamp(now);
          setLastSaved(formattedTime);
        }
      } catch (error) {
        console.error("Error updating row:", error);
      }
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
      const response = await fetch(`/api/csv-rows?id=${rowId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error deleting row:", result.error);
        alert(`❌ Error deleting row: ${result.error || "Unknown error"}`);
      } else {
        await loadData();

        const now = new Date();
        const formattedTime = formatTimestamp(now);
        setLastSaved(formattedTime);
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
        "⚠️ WARNING: This will DELETE ALL rows from Bankinter USD! Are you sure?",
      )
    )
      return;
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?"))
      return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/csv-rows?source=bankinter-usd`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error deleting all rows:", result.error);
        alert(`❌ Error deleting rows: ${result.error || "Unknown error"}`);
      } else {
        await loadData();

        const now = new Date();
        const formattedTime = formatTimestamp(now);
        setLastSaved(formattedTime);

        alert("✅ All rows deleted successfully!");
      }
    } catch (error) {
      console.error("Error deleting all rows:", error);
      alert("Error deleting rows. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadCSV = () => {
    try {
      const headers = [
        "ID",
        "Date",
        "Description",
        "Amount",
        "Payment Source",
        "Payout Reconciliation",
      ];

      const csvContent = [
        headers.join(","),
        ...filteredRows.map((row) =>
          [
            row.id.substring(0, 8) + "...",
            row.date,
            `"${row.description.replace(/"/g, '""')}"`,
            row.amount.toFixed(2),
            row.paymentSource || "N/A",
            row.conciliado ? "Yes" : "No",
          ].join(","),
        ),
      ].join("\\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bankinter-usd-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving CSV file:", error);
      alert("Error downloading CSV file");
    }
  };

  const getPaymentSourceStyle = (source: string | null | undefined) => {
    if (!source)
      return {
        bg: "bg-gray-100",
        text: "text-gray-400",
        border: "border-gray-200",
      };
    return (
      paymentSourceColors[source] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
      }
    );
  };

  // Calcular estatísticas
  const calculateStats = () => {
    const totalIncomes = filteredRows
      .filter((row) => row.amount > 0)
      .reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = filteredRows
      .filter((row) => row.amount < 0)
      .reduce((sum, row) => sum + row.amount, 0);
    const incomesBySource = filteredRows
      .filter((row) => row.amount > 0 && row.paymentSource)
      .reduce(
        (acc, row) => {
          acc[row.paymentSource!] = (acc[row.paymentSource!] || 0) + row.amount;
          return acc;
        },
        {} as Record<string, number>,
      );
    const unreconciledCount = filteredRows.filter(
      (row) => !row.conciliado,
    ).length;

    // Calcular saldo inicial (transactions antes do período filtrado)
    let openingBalance = 0;
    if (dateFrom) {
      openingBalance = rows
        .filter((row) => row.date < dateFrom)
        .reduce((sum, row) => sum + row.amount, 0);
    }

    // Calcular saldo final
    const closingBalance = openingBalance + totalIncomes + totalExpenses;

    // Datas do período
    const sortedByDate = [...filteredRows].sort((a, b) => a.date.localeCompare(b.date));
    const oldestDate = sortedByDate.length > 0 ? sortedByDate[0].date : null;
    const newestDate = sortedByDate.length > 0 ? sortedByDate[sortedByDate.length - 1].date : null;

    return { totalIncomes, totalExpenses, incomesBySource, unreconciledCount, openingBalance, closingBalance, oldestDate, newestDate };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7300]" />
      </div>
    );
  }

  return (
    <div className="min-h-full">

      <div className="">
        <header className="page-header-standard">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Bankinter USD - Bank Statement
                  </h1>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-sm text-gray-300">
                      {rows.length} records ({filteredRows.length} filtered)
                    </p>
                    {lastSaved && (
                      <p className="text-sm text-blue-300 flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        Last Saved: {lastSaved}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 border-white text-white hover:bg-white/10"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button
                  onClick={saveAllChanges}
                  disabled={isSaving || rows.length === 0}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Save All Changes
                    </>
                  )}
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-bankinter"
                />
                <label htmlFor="file-upload-bankinter">
                  <Button
                    variant="outline"
                    className="gap-2 border-black text-black hover:bg-gray-100"
                    asChild
                  >
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>
                <Button
                  onClick={downloadCSV}
                  className="gap-2 bg-black hover:bg-gray-800 text-white"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  onClick={handleDeleteAll}
                  variant="destructive"
                  className="gap-2"
                  disabled={isDeleting || rows.length === 0}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete All
                </Button>
              </div>
            </div>

            {/* Filtros de data */}
            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Date Filters:
                </span>
              </div>
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

            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 font-medium">
                  ✅ All changes saved successfully to database! Last saved:{" "}
                  {lastSaved}
                </AlertDescription>
              </Alert>
            )}

            {lastSaved && !saveSuccess && (
              <div className="mt-3 text-sm text-gray-600 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Last saved: {lastSaved}</span>
              </div>
            )}
          </div>
        </header>

        {/* 🏦 Account Information Card */}
        <div className="px-6 py-4">
          <Card className="bg-gradient-to-r from-[#FF7300] to-[#FF9A3C] border-0 shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                    <Database className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-white">
                    <h3 className="text-lg font-bold">Bankinter Spain</h3>
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">Account:</span> ES91 0128 0823 3901 0005 8256
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">Currency:</span> USD ($)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="font-semibold">Branch:</span> 0128
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right text-white">
                  <p className="text-sm opacity-90">Current Balance</p>
                  <p className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-emerald-200" : "text-red-200"}`}>
                    {formatUSD(stats.closingBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards - Opening Balance, Inflows, Outflows, Closing Balance */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Opening Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.openingBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatUSD(stats.openingBalance)}
                </div>
                <p className="text-xs text-gray-500">
                  {stats.oldestDate ? formatDate(stats.oldestDate) : "No data"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Inflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatUSD(stats.totalIncomes)}
                </div>
                <p className="text-xs text-gray-500">
                  {filteredRows.filter(r => r.amount > 0).length} transactions
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-red-600" />
                  Outflows
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatUSD(stats.totalExpenses)}
                </div>
                <p className="text-xs text-gray-500">
                  {filteredRows.filter(r => r.amount < 0).length} transactions
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-600" />
                  Closing Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-purple-600" : "text-red-600"}`}>
                  {formatUSD(stats.closingBalance)}
                </div>
                <p className="text-xs text-gray-500">
                  {stats.newestDate ? formatDate(stats.newestDate) : "No data"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="px-6 py-8">
          <Card className="shadow-xl border-2 border-gray-200">
            <CardHeader className="bg-[#FF7300] text-white">
              <CardTitle className="text-white">
                Bank Statement Details
              </CardTitle>
              <CardDescription className="text-white/90">
                Upload CSV files - Columns: FECHA VALOR → Date | DESCRIPCIÓN →
                Description | HABER → Amount
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="table-standard">
                  <thead>
                    <tr>
                      <th className="w-24">
                        ID
                      </th>
                      <th>
                        Date
                      </th>
                      <th>
                        Description
                      </th>
                      <th className="text-right">
                        Amount
                      </th>
                      <th className="text-center">
                        Payment Source
                      </th>
                      <th className="text-center">
                        Payout Reconciliation
                      </th>
                      <th className="text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available. Upload a CSV file to get started.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const sourceStyle = getPaymentSourceStyle(
                          row.paymentSource,
                        );
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-gray-200 hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 text-sm font-bold text-black">
                              {row.id.substring(0, 8)}...
                            </td>
                            <td className="py-3 px-4 text-sm text-black">
                              {editingRow === row.id ? (
                                <Input
                                  value={editedData.date || ""}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      date: e.target.value,
                                    })
                                  }
                                  className="w-32"
                                />
                              ) : (
                                row.date
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm max-w-xs truncate text-black">
                              {editingRow === row.id ? (
                                <Input
                                  value={editedData.description || ""}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      description: e.target.value,
                                    })
                                  }
                                  className="w-full"
                                />
                              ) : (
                                row.description
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#FF7300]">
                              {editingRow === row.id ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editedData.amount || 0}
                                  onChange={(e) =>
                                    setEditedData({
                                      ...editedData,
                                      amount: parseFloat(e.target.value),
                                    })
                                  }
                                  className="w-32"
                                />
                              ) : (
                                formatCurrency(row.amount)
                              )}
                            </td>
                            <td className="py-3 px-4 text-center text-sm">
                              {editingRow === row.id ? (
                                <Select
                                  value={editedData.paymentSource || ""}
                                  onValueChange={(value) =>
                                    setEditedData({
                                      ...editedData,
                                      paymentSource: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Braintree EUR">
                                      Braintree EUR
                                    </SelectItem>
                                    <SelectItem value="Braintree USD">
                                      Braintree USD
                                    </SelectItem>
                                    <SelectItem value="Braintree Amex">
                                      Braintree Amex
                                    </SelectItem>
                                    <SelectItem value="Stripe">
                                      Stripe
                                    </SelectItem>
                                    <SelectItem value="GoCardless">
                                      GoCardless
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : row.paymentSource ? (
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sourceStyle.bg} ${sourceStyle.text} border ${sourceStyle.border}`}
                                >
                                  {row.paymentSource}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  N/A
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {row.conciliado ? (
                                <div className="flex items-center justify-center gap-2">
                                  {row.reconciliationType === "automatic" ? (
                                    <div className="relative group">
                                      <Zap className="h-5 w-5 text-green-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        Automatic reconciliation
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative group">
                                      <User className="h-5 w-5 text-blue-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                        Manual reconciliation
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {editingRow === row.id ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    className="h-8 w-8 p-0 bg-black hover:bg-gray-800"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0 border-black text-black"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditing(row)}
                                    className="h-8 w-8 p-0 text-black hover:bg-gray-100"
                                    disabled={isDeleting}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteRow(row.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
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
