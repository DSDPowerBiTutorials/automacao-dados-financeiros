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
  CheckCircle,
  XCircle,
  Settings,
  Database,
  XIcon,
  Zap,
  User,
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
import { formatDate, formatCurrency, formatTimestamp } from "@/lib/formatters";

interface BraintreeEURRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  conciliado: boolean;
  destinationAccount: string | null;
  reconciliationType?: "automatic" | "manual" | null;
  [key: string]: any;
}

interface BankStatementRow {
  date: string;
  amount: number;
  source: string;
}

// Mapeamento de cores por destination account
const destinationAccountColors: {
  [key: string]: { bg: string; text: string; border: string };
} = {
  "Bankinter EUR": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
  "Bankinter USD": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
  "Bankinter GBP": {
    bg: "bg-[#FF7300]/10",
    text: "text-[#FF7300]",
    border: "border-[#FF7300]/20",
  },
};

export default function BraintreeEURPage() {
  const [rows, setRows] = useState<BraintreeEURRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<BraintreeEURRow>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [splitScreenUrl, setSplitScreenUrl] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Função para verificar se duas datas estão dentro de ±3 dias
  const isWithinDateRange = (
    date1: string,
    date2: string,
    dayRange: number = 3,
  ): boolean => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= dayRange;
  };

  const reconcileBankStatements = async (
    braintreeRows: BraintreeEURRow[],
  ): Promise<BraintreeEURRow[]> => {
    try {
      if (!supabase) return braintreeRows;

      // Buscar dados dos bank statements (Bankinter EUR, USD, etc.)
      const { data: bankStatementsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .like("source", "bankinter-%");

      if (error || !bankStatementsData) {
        console.error("Error loading bank statements:", error);
        return braintreeRows;
      }

      // Mapear bank statements
      const bankStatements: BankStatementRow[] = bankStatementsData.map(
        (row) => ({
          date: row.date,
          amount: parseFloat(row.amount) || 0,
          source:
            row.source === "bankinter-eur"
              ? "Bankinter EUR"
              : row.source === "bankinter-usd"
                ? "Bankinter USD"
                : "Bankinter",
        }),
      );

      // Reconciliar cada linha do Braintree EUR
      const reconciledRows = braintreeRows.map((braintreeRow) => {
        // Filtrar bank statements dentro do intervalo de ±3 dias
        const matchingStatements = bankStatements.filter((bs) =>
          isWithinDateRange(braintreeRow.date, bs.date, 3),
        );

        // Tentar match exato com um único ingresso
        const exactMatch = matchingStatements.find(
          (bs) => Math.abs(bs.amount - braintreeRow.amount) < 0.01,
        );

        if (exactMatch) {
          return {
            ...braintreeRow,
            destinationAccount: exactMatch.source,
            conciliado: true,
            reconciliationType: "automatic" as const,
          };
        }

        // Tentar match com soma de múltiplos ingressos da mesma conta
        const accountGroups = new Map<string, number>();
        matchingStatements.forEach((bs) => {
          const currentSum = accountGroups.get(bs.source) || 0;
          accountGroups.set(bs.source, currentSum + bs.amount);
        });

        for (const [account, totalAmount] of accountGroups.entries()) {
          if (Math.abs(totalAmount - braintreeRow.amount) < 0.01) {
            return {
              ...braintreeRow,
              destinationAccount: account,
              conciliado: true,
              reconciliationType: "automatic" as const,
            };
          }
        }

        // Sem match encontrado
        return {
          ...braintreeRow,
          destinationAccount: null,
          conciliado: false,
          reconciliationType: null,
        };
      });

      return reconciledRows;
    } catch (error) {
      console.error("Error reconciling bank statements:", error);
      return braintreeRows;
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        console.warn("Supabase not configured");
        setRows([]);
        setIsLoading(false);
        return;
      }

      const { data: rowsData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "braintree-amex")
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading data:", error);
        setRows([]);
      } else if (rowsData) {
        const mappedRows: BraintreeEURRow[] = rowsData.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          conciliado: row.custom_data?.conciliado || false,
          destinationAccount: row.custom_data?.destinationAccount || null,
          reconciliationType: row.custom_data?.reconciliationType || null,
        }));

        // Reconciliar com bank statements
        const reconciledRows = await reconcileBankStatements(mappedRows);
        setRows(reconciledRows);
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

  const handleDestinationAccountClick = (destinationAccount: string | null) => {
    if (!destinationAccount) return;

    // Mapear o nome da conta para a URL correspondente
    const accountUrlMap: { [key: string]: string } = {
      "Bankinter EUR": "/reports/bankinter-eur",
      "Bankinter USD": "/reports/bankinter-usd",
      "Bankinter GBP": "/reports/bankinter-gbp",
    };

    const url = accountUrlMap[destinationAccount];
    if (url) {
      setSplitScreenUrl(url);
    }
  };

  const closeSplitScreen = () => {
    setSplitScreenUrl(null);
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
        const lines = text.split("\n");

        console.log("=== BRAINTREE EUR CSV PROCESSING ===");
        console.log("Total lines:", lines.length);

        if (lines.length < 2) {
          alert("❌ File is empty or invalid");
          return;
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));
        console.log("Headers found:", headers);

        const disbursementDateIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("disbursement") &&
            h.toLowerCase().includes("date"),
        );
        const settlementSalesIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("settlement") &&
            h.toLowerCase().includes("sales"),
        );
        const discountIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("discount"),
        );
        const multicurrencyIndex = headers.findIndex((h) =>
          h.toLowerCase().includes("multicurrency"),
        );
        const perTransactionIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("per") &&
            h.toLowerCase().includes("transaction"),
        );
        const crossBorderIndex = headers.findIndex(
          (h) =>
            h.toLowerCase().includes("cross") &&
            h.toLowerCase().includes("border"),
        );

        console.log("Column mapping:");
        console.log(
          "- Disbursement Date index:",
          disbursementDateIndex,
          "→",
          headers[disbursementDateIndex],
        );
        console.log(
          "- Settlement Sales index:",
          settlementSalesIndex,
          "→",
          headers[settlementSalesIndex],
        );

        if (disbursementDateIndex === -1 || settlementSalesIndex === -1) {
          alert(
            "❌ Required columns not found! Make sure the file has: disbursement_date, settlement_currency_sales",
          );
          console.error("Available columns:", headers);
          return;
        }

        const newRows: BraintreeEURRow[] = [];
        let processedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values: string[] = [];
          let currentValue = "";
          let insideQuotes = false;

          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];

            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === "," && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = "";
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim());

          const disbursementDate = (values[disbursementDateIndex] || "").trim();
          const settlementSales =
            parseFloat(
              (values[settlementSalesIndex] || "0").replace(/[^\d.-]/g, ""),
            ) || 0;
          const discount =
            discountIndex !== -1
              ? parseFloat(
                  (values[discountIndex] || "0").replace(/[^\d.-]/g, ""),
                ) || 0
              : 0;
          const multicurrency =
            multicurrencyIndex !== -1
              ? parseFloat(
                  (values[multicurrencyIndex] || "0").replace(/[^\d.-]/g, ""),
                ) || 0
              : 0;
          const perTransaction =
            perTransactionIndex !== -1
              ? parseFloat(
                  (values[perTransactionIndex] || "0").replace(/[^\d.-]/g, ""),
                ) || 0
              : 0;
          const crossBorder =
            crossBorderIndex !== -1
              ? parseFloat(
                  (values[crossBorderIndex] || "0").replace(/[^\d.-]/g, ""),
                ) || 0
              : 0;

          const payout =
            settlementSales +
            discount +
            multicurrency +
            perTransaction +
            crossBorder;

          if (payout === 0 && !disbursementDate) continue;

          const uniqueId = `braintree-amex-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          newRows.push({
            id: uniqueId,
            date: disbursementDate,
            description: `Braintree EUR Disbursement - ${disbursementDate}`,
            amount: payout,
            conciliado: false,
            destinationAccount: null,
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

          // Reconciliar com bank statements antes de salvar
          const reconciledRows = await reconcileBankStatements(newRows);

          const rowsToInsert = reconciledRows.map((row) => ({
            id: row.id,
            file_name: "braintree-amex.csv",
            source: "braintree-amex",
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
              destinationAccount: row.destinationAccount,
              reconciliationType: row.reconciliationType,
            },
          }));

          const response = await fetch("/api/csv-rows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rows: rowsToInsert,
              source: "braintree-amex",
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

          const updatedRows = [...rows, ...reconciledRows];
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
        file_name: "braintree-amex.csv",
        source: "braintree-amex",
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
          destinationAccount: row.destinationAccount,
          reconciliationType: row.reconciliationType,
        },
      }));

      const response = await fetch("/api/csv-rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert, source: "braintree-amex" }),
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

  const startEditing = (row: BraintreeEURRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    // Atualizar conciliado se destinationAccount foi definido
    const shouldBeConciliado =
      editedData.destinationAccount !== null &&
      editedData.destinationAccount !== undefined &&
      editedData.destinationAccount !== "";

    const updatedRows = rows.map((row) =>
      row.id === editingRow
        ? {
            ...row,
            ...editedData,
            conciliado: shouldBeConciliado,
            reconciliationType: "manual" as const,
          }
        : row,
    );
    setRows(updatedRows);

    const rowToUpdate = updatedRows.find((r) => r.id === editingRow);
    if (rowToUpdate && supabase) {
      try {
        // Atualizar a linha existente diretamente
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
              destinationAccount: rowToUpdate.destinationAccount,
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
        "⚠️ WARNING: This will DELETE ALL rows from Braintree EUR! Are you sure?",
      )
    )
      return;
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?"))
      return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/csv-rows?source=braintree-amex`, {
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
        "Destination Account",
        "Payout Reconciliation",
      ];

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          [
            row.id.substring(0, 8) + "...",
            formatDate(row.date),
            `"${row.description.replace(/"/g, '""')}"`,
            row.amount.toFixed(2),
            row.destinationAccount || "",
            row.conciliado ? "Yes" : "No",
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `braintree-amex-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving CSV file:", error);
      alert("Error downloading CSV file");
    }
  };

  const getDestinationAccountStyle = (account: string | null) => {
    if (!account)
      return {
        bg: "bg-gray-100",
        text: "text-gray-400",
        border: "border-gray-200",
      };
    return (
      destinationAccountColors[account] || {
        bg: "bg-gray-100",
        text: "text-gray-600",
        border: "border-gray-200",
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      <div
        className={` transition-all duration-300 ${splitScreenUrl ? "md:pr-[50%]" : ""}`}
      >
        <header className="border-b border-[#0f1c34] bg-[#1a2b4a] text-white shadow-lg sticky top-0 z-30">
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
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">
                    Braintree EUR - Payment Source
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
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
                  id="file-upload-braintree"
                />
                <label htmlFor="file-upload-braintree">
                  <Button variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>
                <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2 border-white text-white hover:bg-white/10">
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

            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
                  ✅ All changes saved successfully to database! Last saved:{" "}
                  {lastSaved}
                </AlertDescription>
              </Alert>
            )}

            {lastSaved && !saveSuccess && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Last saved: {lastSaved}</span>
              </div>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Payment Source Details</CardTitle>
              <CardDescription className="text-white/80">
                Upload CSV files - Columns: disbursement_date → Date |
                settlement_currency_sales → Amount (Payout calculated
                automatically)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white w-24">
                        ID
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Date
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Description
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Amount
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Destination Account
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Payout Reconciliation
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available. Upload a CSV file to get started.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const accountStyle = getDestinationAccountStyle(
                          row.destinationAccount,
                        );
                        return (
                          <tr
                            key={row.id}
                            className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="py-3 px-4 text-sm font-bold">
                              {row.id.substring(0, 8)}...
                            </td>
                            <td className="py-3 px-4 text-sm">
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
                                formatDate(row.date)
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm max-w-xs truncate">
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
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
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
                                  value={editedData.destinationAccount || ""}
                                  onValueChange={(value) =>
                                    setEditedData({
                                      ...editedData,
                                      destinationAccount: value,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bankinter EUR">
                                      Bankinter EUR
                                    </SelectItem>
                                    <SelectItem value="Bankinter USD">
                                      Bankinter USD
                                    </SelectItem>
                                    <SelectItem value="Bankinter GBP">
                                      Bankinter GBP
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : row.destinationAccount ? (
                                <button
                                  onClick={() =>
                                    handleDestinationAccountClick(
                                      row.destinationAccount,
                                    )
                                  }
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${accountStyle.bg} ${accountStyle.text} border ${accountStyle.border} hover:opacity-80 transition-opacity cursor-pointer`}
                                >
                                  {row.destinationAccount}
                                </button>
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
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        Automatic reconciliation
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="relative group">
                                      <User className="h-5 w-5 text-blue-600 mx-auto" />
                                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
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
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0"
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
                                    className="h-8 w-8 p-0"
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

      {/* Split Screen Panel */}
      {splitScreenUrl && (
        <div className="fixed top-0 right-0 w-1/2 h-screen bg-white dark:bg-slate-900 shadow-2xl z-40 border-l-4 border-blue-500">
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Bank Statement Details</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeSplitScreen}
                className="text-white hover:bg-blue-800"
              >
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={splitScreenUrl}
                className="w-full h-full border-0"
                title="Bank Statement"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
