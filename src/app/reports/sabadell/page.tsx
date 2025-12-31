"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Edit2,
  Save,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Database,
  Zap,
  User,
  Split,
  Filter,
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

interface SabadellRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  conciliado: boolean;
  paymentSource: string | null | undefined;
  reconciliationType?: "automatic" | "manual" | null;
  isSplit?: boolean;
  splitFrom?: string;
  splitIndex?: number;
  [key: string]: any;
}

interface PaymentSourceRow {
  date: string;
  amount: number;
  source: string;
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

export default function SabadellPage() {
  const [rows, setRows] = useState<SabadellRow[]>([]);
  const [filteredRows, setFilteredRows] = useState<SabadellRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<SabadellRow>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitRowId, setSplitRowId] = useState<string | null>(null);
  const [splitValues, setSplitValues] = useState<number[]>([0, 0]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [rows, dateFrom, dateTo]);

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

  const reconcilePaymentSources = async (
    bankRows: SabadellRow[],
  ): Promise<SabadellRow[]> => {
    try {
      if (!supabase) return bankRows;

      // Buscar dados dos payment sources (Braintree EUR, USD e Amex)
      const { data: paymentSourcesData, error } = await supabase
        .from("csv_rows")
        .select("*")
        .in("source", ["braintree-eur", "braintree-usd", "braintree-amex"]);

      if (error || !paymentSourcesData) {
        console.error("Error loading payment sources:", error);
        return bankRows;
      }

      // Criar lista de payment sources
      const paymentSources: PaymentSourceRow[] = paymentSourcesData.map(
        (row) => ({
          date: row.date,
          amount: parseFloat(row.amount) || 0,
          source:
            row.source === "braintree-eur"
              ? "Braintree EUR"
              : row.source === "braintree-usd"
                ? "Braintree USD"
                : "Braintree Amex",
        }),
      );

      // Reconciliar cada linha do Sabadell
      const reconciledRows = bankRows.map((bankRow) => {
        // Preserve manual reconciliations and split metadata without reprocessing
        if (bankRow.reconciliationType === "manual" || bankRow.isSplit) {
          return bankRow;
        }

        // Filtrar payment sources dentro do intervalo de ±3 dias
        const matchingSources = paymentSources.filter((ps) =>
          isWithinDateRange(bankRow.date, ps.date, 3),
        );

        // Tentar match exato com um único payout
        const exactMatch = matchingSources.find(
          (ps) => Math.abs(ps.amount - bankRow.amount) < 0.01,
        );

        if (exactMatch) {
          return {
            ...bankRow,
            paymentSource: exactMatch.source,
            conciliado: true,
            reconciliationType: "automatic" as const,
          };
        }

        // Tentar match com soma de múltiplos payouts da mesma fonte
        const sourceGroups = new Map<string, number>();
        matchingSources.forEach((ps) => {
          const currentSum = sourceGroups.get(ps.source) || 0;
          sourceGroups.set(ps.source, currentSum + ps.amount);
        });

        for (const [source, totalAmount] of sourceGroups.entries()) {
          if (Math.abs(totalAmount - bankRow.amount) < 0.01) {
            return {
              ...bankRow,
              paymentSource: source,
              conciliado: true,
              reconciliationType: "automatic" as const,
            };
          }
        }

        // Sem match encontrado
        return {
          ...bankRow,
          paymentSource: null,
          conciliado: false,
          reconciliationType: null,
        };
      });

      return reconciledRows;
    } catch (error) {
      console.error("Error reconciling payment sources:", error);
      return bankRows;
    }
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
        .eq("source", "sabadell")
        .order("date", { ascending: false });

      if (error) {
        console.error("Error loading data:", error);
        setRows([]);
      } else if (rowsData) {
        const mappedRows: SabadellRow[] = rowsData.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description || "",
          amount: parseFloat(row.amount) || 0,
          balance: parseFloat(row.custom_data?.balance) || 0,
          conciliado: row.custom_data?.conciliado || false,
          paymentSource: row.custom_data?.paymentSource || null,
          reconciliationType: row.custom_data?.reconciliationType || null,
          isSplit: row.custom_data?.isSplit || false,
          splitFrom: row.custom_data?.splitFrom || null,
          splitIndex: row.custom_data?.splitIndex || null,
        }));

        // Reconciliar automaticamente
        const reconciledRows = await reconcilePaymentSources(mappedRows);
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

        console.log("=== SABADELL CSV PROCESSING ===");
        console.log("Total lines:", lines.length);

        if (lines.length < 2) {
          alert("❌ File is empty or invalid");
          return;
        }

        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^\\"|\\"$/g, ""));
        console.log("Headers found:", headers);

        const fechaIndex = headers.findIndex((h) =>
          h.toUpperCase().includes("FECHA"),
        );
        const descripcionIndex = headers.findIndex((h) =>
          h
            .toUpperCase()
            .replace(/[ÃÓÑ\\"]/g, "O")
            .includes("DESCRIPCI"),
        );
        const importeIndex = headers.findIndex((h) =>
          h.toUpperCase().includes("IMPORTE"),
        );
        const saldoIndex = headers.findIndex((h) =>
          h.toUpperCase().includes("SALDO"),
        );

        console.log("Column mapping:");
        console.log("- FECHA index:", fechaIndex, "→", headers[fechaIndex]);
        console.log(
          "- DESCRIPCIÓN index:",
          descripcionIndex,
          "→",
          headers[descripcionIndex],
        );
        console.log(
          "- IMPORTE index:",
          importeIndex,
          "→",
          headers[importeIndex],
        );
        console.log("- SALDO index:", saldoIndex, "→", headers[saldoIndex]);

        if (
          fechaIndex === -1 ||
          descripcionIndex === -1 ||
          importeIndex === -1
        ) {
          alert(
            "❌ Required columns not found! Make sure the file has: FECHA, DESCRIPCIÓN, IMPORTE",
          );
          console.error("Available columns:", headers);
          return;
        }

        const newRows: SabadellRow[] = [];
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

          const fecha = (values[fechaIndex] || "").trim();
          const descripcion = (values[descripcionIndex] || "").trim();
          const importeValue = (values[importeIndex] || "0").trim();
          const saldoValue = (values[saldoIndex] || "0").trim();

          let amountNumber = 0;
          if (importeValue) {
            const cleanValue = importeValue
              .replace(/\\s/g, "")
              .replace(",", ".");

            amountNumber = parseFloat(cleanValue) || 0;
          }

          let balanceNumber = 0;
          if (saldoValue) {
            const cleanValue = saldoValue.replace(/\\s/g, "").replace(",", ".");

            balanceNumber = parseFloat(cleanValue) || 0;
          }

          if (amountNumber === 0 && !descripcion) continue;

          const uniqueId = `SABADELL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          newRows.push({
            id: uniqueId,
            date: fecha,
            description: descripcion,
            amount: amountNumber,
            balance: balanceNumber,
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

          // Reconciliar automaticamente antes de salvar
          const reconciledRows = await reconcilePaymentSources(newRows);

          const rowsToInsert = reconciledRows.map((row) => ({
            id: row.id,
            file_name: "sabadell.csv",
            source: "sabadell",
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
              balance: row.balance,
              conciliado: row.conciliado,
              paymentSource: row.paymentSource,
              reconciliationType: row.reconciliationType,
            },
          }));

          const response = await fetch("/api/csv-rows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: rowsToInsert, source: "sabadell" }),
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
        file_name: "sabadell.csv",
        source: "sabadell",
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
          balance: row.balance,
          conciliado: row.conciliado,
          paymentSource: row.paymentSource,
          reconciliationType: row.reconciliationType,
          isSplit: row.isSplit,
          splitFrom: row.splitFrom,
          splitIndex: row.splitIndex,
        },
      }));

      const response = await fetch("/api/csv-rows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert, source: "sabadell" }),
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

  const startEditing = (row: SabadellRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    // Atualizar conciliado se paymentSource foi definido
    const shouldBeConciliado =
      editedData.paymentSource !== null &&
      editedData.paymentSource !== undefined &&
      editedData.paymentSource !== "" &&
      editedData.paymentSource !== "N/A";

    const updatedRows = rows.map((row) =>
      row.id === editingRow
        ? {
          ...row,
          ...editedData,
          paymentSource:
            editedData.paymentSource === "N/A"
              ? null
              : editedData.paymentSource,
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
              balance: rowToUpdate.balance,
              conciliado: rowToUpdate.conciliado,
              paymentSource: rowToUpdate.paymentSource,
              reconciliationType: rowToUpdate.reconciliationType,
              isSplit: rowToUpdate.isSplit,
              splitFrom: rowToUpdate.splitFrom,
              splitIndex: rowToUpdate.splitIndex,
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

  const openSplitDialog = (rowId: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (row) {
      setSplitRowId(rowId);
      setSplitValues([row.amount / 2, row.amount / 2]);
      setShowSplitDialog(true);
    }
  };

  const addSplitLine = () => {
    if (splitValues.length < 8) {
      setSplitValues([...splitValues, 0]);
    }
  };

  const removeSplitLine = (index: number) => {
    if (splitValues.length > 2) {
      const newValues = splitValues.filter((_, i) => i !== index);
      setSplitValues(newValues);
    }
  };

  const updateSplitValue = (index: number, value: number) => {
    const newValues = [...splitValues];
    newValues[index] = value;
    setSplitValues(newValues);
  };

  const applySplit = async () => {
    if (!splitRowId) return;

    const originalRow = rows.find((r) => r.id === splitRowId);
    if (!originalRow) return;

    const total = splitValues.reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - originalRow.amount) >= 0.01) {
      alert(
        `❌ O total do split (${formatCurrency(total)}) deve ser igual ao valor original (${formatCurrency(originalRow.amount)})`,
      );
      return;
    }

    try {
      setIsSaving(true);

      // Criar novas linhas para o split
      const splitRows: SabadellRow[] = splitValues.map((value, index) => ({
        id: `${splitRowId}-SPLIT-${index + 1}`,
        date: originalRow.date,
        description: `${originalRow.description} (Split ${index + 1}/${splitValues.length})`,
        amount: value,
        balance: originalRow.balance,
        conciliado: false,
        paymentSource: null,
        reconciliationType: null,
        isSplit: true,
        splitFrom: splitRowId,
        splitIndex: index + 1,
      }));

      // Remover linha original e adicionar splits
      const updatedRows = rows
        .filter((r) => r.id !== splitRowId)
        .concat(splitRows);
      setRows(updatedRows);

      // Salvar no banco
      const rowsToInsert = splitRows.map((row) => ({
        id: row.id,
        file_name: "sabadell.csv",
        source: "sabadell",
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
          balance: row.balance,
          conciliado: row.conciliado,
          paymentSource: row.paymentSource,
          reconciliationType: row.reconciliationType,
          isSplit: row.isSplit,
          splitFrom: row.splitFrom,
          splitIndex: row.splitIndex,
        },
      }));

      // Deletar linha original
      await supabase?.from("csv_rows").delete().eq("id", splitRowId);

      // Inserir splits
      const response = await fetch("/api/csv-rows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToInsert, source: "sabadell" }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("Error saving split:", result.error);
        alert(`❌ Error saving split: ${result.error || "Unknown error"}`);
        return;
      }

      const now = new Date();
      const formattedTime = formatTimestamp(now);
      setLastSaved(formattedTime);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      setShowSplitDialog(false);
      setSplitRowId(null);
      setSplitValues([0, 0]);
    } catch (error) {
      console.error("Error applying split:", error);
      alert("Error applying split. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const downloadCSV = () => {
    try {
      const headers = [
        "ID",
        "Date",
        "Description",
        "Amount",
        "Balance",
        "Payment Source",
        "Payout Reconciliation",
        "Split Info",
      ];

      const csvContent = [
        headers.join(","),
        ...filteredRows.map((row) =>
          [
            row.id.substring(0, 8) + "...",
            formatDate(row.date),
            `"${row.description.replace(/"/g, '""')}"`,
            row.amount.toFixed(2),
            row.balance.toFixed(2),
            row.paymentSource || "N/A",
            row.conciliado ? "Yes" : "No",
            row.isSplit ? `Split ${row.splitIndex}` : "",
          ].join(","),
        ),
      ].join("\\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sabadell-${new Date().toISOString().split("T")[0]}.csv`;
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
    const currentBalance =
      filteredRows.length > 0 ? filteredRows[0].balance : 0;

    return { totalIncomes, incomesBySource, unreconciledCount, currentBalance };
  };

  const { totalIncomes, incomesBySource, unreconciledCount, currentBalance } =
    calculateStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#FF7300]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">

      <div className="">
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
                  <h1 className="text-2xl font-bold text-black">
                    Sabadell - Bank Statement
                  </h1>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredRows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white text-white hover:bg-white/10"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button
                  onClick={saveAllChanges}
                  disabled={isSaving || rows.length === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white text-white hover:bg-white/10"
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
                  id="file-upload-sabadell"
                />
                <label htmlFor="file-upload-sabadell">
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

        <div className="container mx-auto px-6 py-8">
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Current Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(currentBalance)}
                </div>
              </CardContent>
            </Card>

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
                  {unreconciledCount}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Incomes by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(incomesBySource).map(([source, amount]) => (
                    <div key={source} className="flex justify-between text-sm">
                      <span>{source}:</span>
                      <span className="font-medium">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(incomesBySource).length === 0 && (
                    <div className="text-sm text-gray-500">
                      No reconciled incomes
                    </div>
                  )}
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
                Upload CSV files - Columns: FECHA → Date | DESCRIPCIÓN →
                Description | IMPORTE → Amount | SALDO → Balance
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="text-left py-4 px-4 font-bold text-sm text-black w-24">
                        ID
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">
                        Date
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-black">
                        Description
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">
                        Amount
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-black">
                        Balance
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">
                        Payment Source
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">
                        Payout Reconciliation
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-black">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
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
                            className={`border-b border-gray-200 hover:bg-gray-50 ${row.isSplit ? "bg-blue-50" : ""}`}
                          >
                            <td className="py-3 px-4 text-sm font-bold text-black">
                              <div className="flex items-center gap-2">
                                {row.isSplit && (
                                  <Split className="h-4 w-4 text-blue-600" />
                                )}
                                {row.id.substring(0, 8)}...
                              </div>
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
                                formatDate(row.date)
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
                            <td className="py-3 px-4 text-sm text-right font-bold text-blue-600">
                              {formatCurrency(row.balance)}
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
                                    <SelectItem value="N/A">N/A</SelectItem>
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
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  {!row.isSplit && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openSplitDialog(row.id)}
                                      className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                                      title="Split value"
                                    >
                                      <Split className="h-4 w-4" />
                                    </Button>
                                  )}
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

      {/* Split Dialog */}
      {showSplitDialog && splitRowId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Split Value</h3>
            <p className="text-sm text-gray-600 mb-4">
              Original amount:{" "}
              {formatCurrency(
                rows.find((r) => r.id === splitRowId)?.amount || 0,
              )}
            </p>
            <div className="space-y-2 mb-4">
              {splitValues.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-sm font-medium w-16">
                    Line {index + 1}:
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) =>
                      updateSplitValue(index, parseFloat(e.target.value) || 0)
                    }
                    className="flex-1"
                  />
                  {splitValues.length > 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSplitLine(index)}
                      className="h-8 w-8 p-0 text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mb-4">
              <p className="text-sm font-medium">
                Total:{" "}
                {formatCurrency(splitValues.reduce((sum, val) => sum + val, 0))}
              </p>
            </div>
            {splitValues.length < 8 && (
              <Button
                variant="outline"
                onClick={addSplitLine}
                className="w-full mb-4"
              >
                Add Line ({splitValues.length}/8)
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSplitDialog(false);
                  setSplitRowId(null);
                  setSplitValues([0, 0]);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={applySplit}
                className="flex-1 bg-black hover:bg-gray-800 text-white"
              >
                Apply Split
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
