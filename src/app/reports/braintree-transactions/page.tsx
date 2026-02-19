"use client";

import { useState, useEffect } from "react";
import type { CSVRow } from "@/lib/database";
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
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import BraintreeApiSync from "@/components/braintree/api-sync-button";

interface BraintreeTransactionRow {
  id: string;
  payout: string;
  transaction_id: string;
  disbursement_date: string;
  currency_iso_code: string;
  amount_authorized: number;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  order_id_1: string;
  order_id_2: string;
  order_id_3: string;
  order_id_4: string;
  customer_name: string;
  bank_conciliation: boolean;
  braintree_eur_conciliation: boolean;
  [key: string]: any;
}

interface BraintreeEURRow {
  id: string;
  disbursement_date: string;
  payout: number;
  [key: string]: any;
}

export default function BraintreeTransactionsPage() {
  const [rows, setRows] = useState<BraintreeTransactionRow[]>([]);
  const [braintreeEURRows, setBraintreeEURRows] = useState<BraintreeEURRow[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<
    Partial<BraintreeTransactionRow>
  >({});
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadData();

    // ✅ Escutar mudanças em tempo real do Supabase
    const subscription = supabase
      .channel('braintree_transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'csv_rows',
          filter: 'source=in.(braintree-api-revenue,braintree-api-fees,braintree-api-disbursement)',
        },
        (payload) => {
          console.log('[Realtime Braintree Transactions] Change detected:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await loadAllCSVFiles();

      // Carregar Braintree Transactions
      const transactionsFile = data.find(
        (f) => f.source === "braintree-transactions",
      );
      if (transactionsFile) {
        setRows(transactionsFile.rows as unknown as BraintreeTransactionRow[]);
      } else {
        setRows([]);
      }

      // Carregar Braintree EUR para conciliação
      const braintreeEURFile = data.find((f) => f.source === "braintree-eur");
      if (braintreeEURFile) {
        setBraintreeEURRows(
          braintreeEURFile.rows as unknown as BraintreeEURRow[],
        );
      }

      // Executar conciliação automática
      if (transactionsFile && braintreeEURFile) {
        performConciliation(
          transactionsFile.rows as unknown as BraintreeTransactionRow[],
          braintreeEURFile.rows as unknown as BraintreeEURRow[],
        );
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const performConciliation = (
    transactionsData: BraintreeTransactionRow[],
    braintreeEURData: BraintreeEURRow[],
  ) => {
    // Group transactions por Disbursement Date e Currency = EUR
    const groupedTransactions = new Map<string, BraintreeTransactionRow[]>();

    transactionsData.forEach((tx) => {
      if (tx.currency_iso_code === "EUR" && tx.disbursement_date) {
        const key = tx.disbursement_date;
        if (!groupedTransactions.has(key)) {
          groupedTransactions.set(key, []);
        }
        groupedTransactions.get(key)!.push(tx);
      }
    });

    // Para cada grupo, verificar se existe payout correspondente no Braintree EUR
    const reconciledRows = transactionsData.map((tx) => {
      if (tx.currency_iso_code !== "EUR" || !tx.disbursement_date) {
        return {
          ...tx,
          customer_name:
            `${tx.customer_first_name || ""} ${tx.customer_last_name || ""}`.trim(),
          bank_conciliation: false,
          braintree_eur_conciliation: false,
        };
      }

      // Fetch all transactions of the same day
      const sameDayTransactions =
        groupedTransactions.get(tx.disbursement_date) || [];

      // Sum values of transactions of the same day
      const totalAmount = sameDayTransactions.reduce(
        (sum, t) =>
          sum + (parseFloat(t.amount_authorized?.toString() || "0") || 0),
        0,
      );

      // Procurar no Braintree EUR se existe payout com mesmo valor e data
      const matchingPayout = braintreeEURData.find((btEUR) => {
        const valueMatch = Math.abs(totalAmount - btEUR.payout) < 0.01;
        const dateMatch = btEUR.disbursement_date === tx.disbursement_date;
        return valueMatch && dateMatch;
      });

      return {
        ...tx,
        customer_name:
          `${tx.customer_first_name || ""} ${tx.customer_last_name || ""}`.trim(),
        bank_conciliation: matchingPayout ? true : false,
        braintree_eur_conciliation: matchingPayout ? true : false,
      };
    });

    setRows(reconciledRows);
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
        const headers = lines[0]
          .split(",")
          .map((h) => h.trim().replace(/^"|"$/g, ""));

        const newRows: BraintreeTransactionRow[] = [];
        let idCounter = rows.length + 1;

        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;

          const values = lines[i]
            .split(",")
            .map((v) => v.trim().replace(/^"|"$/g, ""));
          const row: any = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          // Extrair as 4 colunas de Order ID
          const orderIds = headers
            .map((h, idx) => (h === "Order ID" ? values[idx] : null))
            .filter((v) => v !== null);

          newRows.push({
            id: `BT-TX-${String(idCounter).padStart(4, "0")}`,
            payout: row["PAYOUT"] || "",
            transaction_id: row["Transaction ID"] || "",
            disbursement_date: row["Disbursement Date"] || "",
            currency_iso_code: row["Currency ISO Code"] || "",
            amount_authorized: parseFloat(row["Amount Authorized"]) || 0,
            customer_first_name: row["Customer First Name"] || "",
            customer_last_name: row["Customer Last Name"] || "",
            customer_email: row["Customer Email"] || "",
            order_id_1: orderIds[0] || "",
            order_id_2: orderIds[1] || "",
            order_id_3: orderIds[2] || "",
            order_id_4: orderIds[3] || "",
            customer_name:
              `${row["Customer First Name"] || ""} ${row["Customer Last Name"] || ""}`.trim(),
            bank_conciliation: false,
            braintree_eur_conciliation: false,
            ...row,
          });
          idCounter++;
        }

        const updatedRows = [...rows, ...newRows];
        setRows(updatedRows);

        // Executar conciliação
        performConciliation(updatedRows, braintreeEURRows);

        // Save no Supabase
        const totalAmount = updatedRows.reduce(
          (sum, row) => sum + row.amount_authorized,
          0,
        );
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

        await saveCSVFile({
          name: file.name,
          lastUpdated: formattedDate,
          rows: updatedRows as unknown as CSVRow[],
          totalAmount: totalAmount,
          source: "braintree-transactions",
        });
      };

      reader.readAsText(file);
    }
  };

  const startEditing = (row: BraintreeTransactionRow) => {
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
        // Recarregar dados do banco após deletar
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
        "⚠️ WARNING: This will DELETE ALL rows from Braintree Transactions! Are you sure?",
      )
    )
      return;
    if (!confirm("⚠️ FINAL WARNING: This action CANNOT be undone! Continue?"))
      return;

    setIsDeleting(true);
    try {
      // Deletar todas as linhas uma por uma
      for (const row of rows) {
        await deleteCSVRow(row.id);
      }

      // Recarregar dados do banco após deletar tudo
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
      "Payout",
      "Transaction ID",
      "Disbursement Date",
      "Currency",
      "Amount",
      "Customer Name",
      "Email",
      "Order ID 1",
      "Order ID 2",
      "Order ID 3",
      "Order ID 4",
      "Bank Conciliation",
      "Braintree EUR Conciliation",
    ];

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.payout,
          row.transaction_id,
          row.disbursement_date,
          row.currency_iso_code,
          row.amount_authorized,
          row.customer_name,
          row.customer_email,
          row.order_id_1,
          row.order_id_2,
          row.order_id_3,
          row.order_id_4,
          row.bank_conciliation ? "Yes" : "No",
          row.braintree_eur_conciliation ? "Yes" : "No",
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `braintree-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const reconciledCount = rows.filter(
    (r) => r.bank_conciliation && r.braintree_eur_conciliation,
  ).length;
  const unreconciledCount = rows.length - reconciledCount;

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
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
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">
                    Braintree Transactions
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records | {reconciledCount} reconciled |{" "}
                    {unreconciledCount} pending
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-transactions"
                />
                <label htmlFor="file-upload-transactions">
                  <Button variant="outline" size="sm" className="gap-2 border-white text-gray-900 dark:text-white hover:bg-white/10" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>

                {/* Direct sync via API */}
                <BraintreeApiSync />

                <Button
                  onClick={loadData}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white text-gray-900 dark:text-white hover:bg-white/10"
                  title="Force data refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                <Button onClick={downloadCSV} variant="outline" size="sm" className="gap-2 border-white text-gray-900 dark:text-white hover:bg-white/10">
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
          </div>
        </header>

        <div className="px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="shadow-xl border-2 border-[#e5e7eb]">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <p className="text-sm font-bold text-gray-900 dark:text-white/80 mb-2">
                  Total Transactions
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
              </div>
            </Card>
            <Card className="shadow-xl border-2 border-green-200">
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-6">
                <p className="text-sm font-bold text-gray-900 dark:text-white/80 mb-2">
                  Reconciled
                </p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {reconciledCount}
                </p>
              </div>
            </Card>
            <Card className="shadow-xl border-2 border-orange-200">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6">
                <p className="text-sm font-bold text-gray-900 dark:text-white/80 mb-2">Pending</p>
                <p className="text-4xl font-bold text-gray-900 dark:text-white">
                  {unreconciledCount}
                </p>
              </div>
            </Card>
          </div>

          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>
                All Braintree Transactions with Conciliation
              </CardTitle>
              <CardDescription className="text-gray-900 dark:text-white/80">
                Automatic reconciliation with Braintree EUR payouts
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-black">
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        ID
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Transaction ID
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Date
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Currency
                      </th>
                      <th className="text-right py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Amount
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Customer Name
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Email
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Order ID 1
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Order ID 2
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Order ID 3
                      </th>
                      <th className="text-left py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Order ID 4
                      </th>
                      <th className="text-center py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Bank Conciliation
                      </th>
                      <th className="text-center py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Braintree EUR
                      </th>
                      <th className="text-center py-4 px-3 font-bold text-xs text-[#1a2b4a] dark:text-white">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-[#111111]/50"
                      >
                        <td className="py-3 px-3 text-xs font-bold">
                          {row.id}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.transaction_id}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.disbursement_date}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <Badge variant="outline">
                            {row.currency_iso_code}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-xs text-right font-bold text-[#4fc3f7]">
                          €{row.amount_authorized.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.customer_name}
                        </td>
                        <td className="py-3 px-3 text-xs max-w-[150px] truncate">
                          {row.customer_email}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.order_id_1 || "-"}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.order_id_2 || "-"}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.order_id_3 || "-"}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {row.order_id_4 || "-"}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.bank_conciliation ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {row.braintree_eur_conciliation ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400 mx-auto" />
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(row)}
                              className="h-7 w-7 p-0"
                              disabled={isDeleting}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRow(row.id)}
                              className="h-7 w-7 p-0 text-red-600"
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
