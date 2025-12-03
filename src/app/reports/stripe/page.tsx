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
import { Sidebar } from "@/components/custom/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface StripeRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  conciliado: boolean;
  [key: string]: any;
}

export default function StripePage() {
  const [rows, setRows] = useState<StripeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<StripeRow>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await loadAllCSVFiles();
      const stripeFile = data.find((f) => f.source === "stripe");
      if (stripeFile) {
        setRows(stripeFile.rows as StripeRow[]);
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
        const lines = text.split("\n");
        const headers = lines[0]
          .split(",")
          .map((h) => String(h ?? "").trim().replace(/^"|"$/g, ""));

        const newRows: StripeRow[] = [];
        let idCounter = rows.length + 1;

        for (let i = 1; i < lines.length; i++) {
          if (!String(lines[i] ?? "").trim()) continue;

          const values = lines[i]
            .split(",")
            .map((v) => String(v ?? "").trim().replace(/^"|"$/g, ""));
          const row: any = {};

          headers.forEach((header, index) => {
            row[header] = values[index] || "";
          });

          const payoutDate =
            row["automatic_payout_effective_at"] ||
            new Date().toLocaleDateString("pt-BR");
          const netAmount = parseFloat(row["net"]) || 0;

          newRows.push({
            id: `ST-${String(idCounter).padStart(4, "0")}`,
            date: payoutDate,
            description:
              row["description"] || `Stripe Transaction - ${payoutDate}`,
            amount: netAmount,
            conciliado: false,
            ...row,
          });

          idCounter++;
        }

        const updatedRows = [...rows, ...newRows];
        setRows(updatedRows);

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
          source: "stripe",
        });

        const now = new Date();
        const formattedTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setLastSaved(formattedTime);

        alert(
          `✅ File uploaded successfully! ${newRows.length} rows processed and saved to database.`,
        );
      };

      reader.readAsText(file);
    }
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);
      const today = new Date();
      const formattedDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

      await saveCSVFile({
        name: "stripe.csv",
        lastUpdated: formattedDate,
        rows: rows,
        totalAmount: totalAmount,
        source: "stripe",
      });

      const now = new Date();
      const formattedTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
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

  const startEditing = (row: StripeRow) => {
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

      const now = new Date();
      const formattedTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setLastSaved(formattedTime);
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

        const now = new Date();
        const formattedTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        setLastSaved(formattedTime);
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
        "⚠️ WARNING: This will DELETE ALL rows from Stripe! Are you sure?",
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

      const now = new Date();
      const formattedTime = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setLastSaved(formattedTime);

      alert("✅ All rows deleted successfully!");
    } catch (error) {
      console.error("Error deleting all rows:", error);
      alert("Error deleting rows. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadCSV = () => {
    try {
      const headers = ["ID", "Date", "Description", "Amount", "Conciliado"];

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          [
            row.id,
            row.date,
            `"${row.description.replace(/"/g, '""')}"`,
            row.amount.toFixed(2),
            row.conciliado ? "Yes" : "No",
          ].join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stripe-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving CSV file:", error);
      alert("Error downloading CSV file");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Sidebar currentPage="stripe" paymentSourceDates={{}} />

      <div className="md:pl-64">
        <header className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-white dark:bg-[#1a2b4a] shadow-lg sticky top-0 z-30">
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
                    Stripe - Payment Processing
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
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
                  id="file-upload-stripe"
                />
                <label htmlFor="file-upload-stripe">
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>
                <Button onClick={downloadCSV} className="gap-2 bg-[#1a2b4a]">
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
              <CardTitle>Payment Processing Details</CardTitle>
              <CardDescription className="text-white/80">
                Upload CSV files from Stripe payment platform
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">
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
                        Conciliado
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
                          colSpan={6}
                          className="py-8 text-center text-gray-500"
                        >
                          No data available. Upload a CSV file to get started.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-4 text-sm font-bold">
                            {row.id}
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
                              row.date
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
                              `€${row.amount.toFixed(2)}`
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {row.conciliado ? (
                              <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
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
