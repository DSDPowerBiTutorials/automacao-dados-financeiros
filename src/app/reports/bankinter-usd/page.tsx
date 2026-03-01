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
  RefreshCw,
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
import { PageHeader } from "@/components/ui/page-header";

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
  const [isAutoReconciling, setIsAutoReconciling] = useState(false);
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

  // Auto-reconcile with disbursements from Braintree, Stripe, GoCardless
  const handleAutoReconcile = async () => {
    setIsAutoReconciling(true);
    try {
      // First do a dry run
      const dryResponse = await fetch('/api/reconcile/bank-disbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true, bankSource: 'bankinter-usd' })
      });
      const dryResult = await dryResponse.json();

      if (!dryResult.success) {
        alert(`Error: ${dryResult.error || 'Failed to check reconciliation'}`);
        return;
      }

      if (dryResult.summary.matched === 0) {
        alert('No matches found. No disbursements match pending bank transactions.');
        return;
      }

      // Confirm with user
      const confirmMsg = `Found ${dryResult.summary.matched} matches:\n` +
        `• Braintree: ${dryResult.summary.bySource.braintree}\n` +
        `• Stripe: ${dryResult.summary.bySource.stripe}\n` +
        `• GoCardless: ${dryResult.summary.bySource.gocardless}\n\n` +
        `Total value: $${dryResult.summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n` +
        `Apply reconciliation?`;

      if (!confirm(confirmMsg)) return;

      // Apply reconciliation
      const response = await fetch('/api/reconcile/bank-disbursement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, bankSource: 'bankinter-usd' })
      });
      const result = await response.json();

      if (result.success) {
        alert(`✅ Reconciliation Complete: ${result.summary.updated} transactions reconciled`);
        await loadData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error("Auto-reconcile error:", error);
      alert("Failed to auto-reconcile");
    } finally {
      setIsAutoReconciling(false);
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
        text: "text-gray-500 dark:text-gray-400",
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

  // Calcular estatísticas (usando saldo real do CSV)
  const calculateStats = () => {
    if (filteredRows.length === 0) {
      return {
        totalIncomes: 0,
        totalExpenses: 0,
        incomesBySource: {} as Record<string, number>,
        unreconciledCount: 0,
        openingBalance: 0,
        closingBalance: 0,
        oldestDate: null as string | null,
        newestDate: null as string | null
      };
    }

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

    // Ordenar por data (mais antiga primeiro)
    const sortedByDate = [...filteredRows].sort((a, b) => a.date.localeCompare(b.date));

    // Usar saldo real do CSV (primeira transação = opening, última = closing)
    const firstRow = sortedByDate[0];
    const lastRow = sortedByDate[sortedByDate.length - 1];

    // Opening Balance = saldo da primeira transação MENOS o amount dessa transação
    const firstBalance = (firstRow as any).custom_data?.saldo ?? (firstRow as any).custom_data?.balance ?? 0;
    const openingBalance = firstBalance - firstRow.amount;

    // Closing Balance = saldo da última transação (saldo APÓS todas as transações)
    const closingBalance = (lastRow as any).custom_data?.saldo ?? (lastRow as any).custom_data?.balance ?? 0;

    const oldestDate = firstRow.date;
    const newestDate = lastRow.date;

    return { totalIncomes, totalExpenses, incomesBySource, unreconciledCount, openingBalance, closingBalance, oldestDate, newestDate };
  };

  const stats = calculateStats();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7300]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <PageHeader title="Bankinter USD - Bank Statement" subtitle={`${rows.length} records (${filteredRows.length} filtered)${lastSaved ? ` • Last saved: ${lastSaved}` : ""}`}>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
          <p className={`text-2xl font-bold ${stats.closingBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
            ${formatUSD(stats.closingBalance)}
          </p>
        </div>
      </PageHeader>
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload-bankinter" />
            <label htmlFor="file-upload-bankinter">
              <Button variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]" asChild>
                <span><Upload className="h-4 w-4 mr-1" />Upload CSV</span>
              </Button>
            </label>
            <Button onClick={loadData} disabled={isLoading} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button onClick={handleAutoReconcile} disabled={isAutoReconciling} variant="outline" size="sm" className="bg-transparent border-green-700 text-green-400 hover:bg-green-900/30">
              {isAutoReconciling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}
              Auto-Reconcile
            </Button>
            <Button onClick={downloadCSV} variant="outline" size="sm" className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
              <Download className="h-4 w-4 mr-1" />Download
            </Button>
            <Button onClick={handleDeleteAll} variant="outline" size="sm" className="bg-transparent border-red-800 text-red-400 hover:bg-red-900/30" disabled={isDeleting || rows.length === 0}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete All
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">From:</span>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
            <span className="text-sm text-gray-500 dark:text-gray-400">To:</span>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white" />
            <Button variant="outline" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="bg-transparent border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
              <X className="h-4 w-4 mr-1" />Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-100 dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">Credits:</span>
            <span className="text-green-400 font-medium">${formatUSD(stats.totalIncomes)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">Debits:</span>
            <span className="text-red-400 font-medium">${formatUSD(stats.totalExpenses)}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-gray-500 dark:text-gray-400 text-sm">Reconciled:</span>
            <span className="text-green-400 font-medium">{stats.reconciledCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-gray-500 dark:text-gray-400 text-sm">Unreconciled:</span>
            <span className="text-yellow-400 font-medium">{stats.unreconciledCount}</span>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-[#0a0a0a] border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase min-w-[900px]">
          <div className="w-[70px] flex-shrink-0">Date</div>
          <div className="flex-1 min-w-[200px]">Description</div>
          <div className="w-[90px] flex-shrink-0 text-right">Debit</div>
          <div className="w-[90px] flex-shrink-0 text-right">Credit</div>
          <div className="w-[100px] flex-shrink-0 text-right">Balance</div>
          <div className="w-[100px] flex-shrink-0 text-center">Source</div>
          <div className="w-[80px] flex-shrink-0 text-center">Status</div>
          <div className="w-[70px] flex-shrink-0 text-center">Actions</div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20 overflow-x-auto">
        {filteredRows.map((row) => {
          const sourceStyle = getPaymentSourceStyle(row.paymentSource);
          const isDebit = row.amount < 0;
          const isCredit = row.amount > 0;
          const customData = row.custom_data || {};

          return (
            <div
              key={row.id}
              className="flex items-center gap-1 px-4 py-2 hover:bg-gray-50 dark:bg-black/30 border-t border-gray-200 dark:border-gray-800/50 min-w-[900px]"
            >
              <div className="w-[70px] flex-shrink-0 text-[11px] text-gray-700 dark:text-gray-300">
                {formatDate(row.date)}
              </div>
              <div className="flex-1 min-w-[200px] text-[11px] text-gray-900 dark:text-white truncate" title={row.description}>
                {row.description}
              </div>
              <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                {isDebit ? (
                  <span className="text-red-400">${formatUSD(Math.abs(row.amount))}</span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </div>
              <div className="w-[90px] flex-shrink-0 text-right text-[11px] font-mono">
                {isCredit ? (
                  <span className="text-green-400">${formatUSD(row.amount)}</span>
                ) : (
                  <span className="text-gray-600">-</span>
                )}
              </div>
              <div className="w-[100px] flex-shrink-0 text-right text-[11px] font-mono font-medium text-gray-900 dark:text-white">
                ${formatUSD(customData.saldo || customData.balance || 0)}
              </div>
              <div className="w-[100px] flex-shrink-0 text-center">
                {row.paymentSource ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${sourceStyle.bg} ${sourceStyle.text} border ${sourceStyle.border}`}>
                    {row.paymentSource}
                  </span>
                ) : (
                  <span className="text-gray-600 text-[10px]">-</span>
                )}
              </div>
              <div className="w-[80px] flex-shrink-0 text-center">
                {row.conciliado ? (
                  <div className="flex items-center justify-center gap-1">
                    {row.reconciliationType === "automatic" ? (
                      <Zap className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-blue-500" />
                    )}
                  </div>
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-yellow-500 mx-auto" />
                )}
              </div>
              <div className="w-[70px] flex-shrink-0 flex items-center justify-center gap-1">
                {editingRow === row.id ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={saveEdit} className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-900/30">
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111111]">
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => startEditing(row)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#111111]">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRow(row.id)} className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-900/30">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
