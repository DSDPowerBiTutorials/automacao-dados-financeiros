"use client";

import { useState, useEffect } from "react";
import {
  Edit2,
  Save,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Columns3,
  ArrowUpDown,
  Sync,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { formatDate, formatCurrency, formatTimestamp } from "@/lib/formatters";

interface GoCardlessRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  reconciled: boolean;
  custom_data?: {
    type?: "payment" | "payout" | "refund";
    payout_id?: string;
    payment_id?: string;
    status?: string;
    currency?: string;
    gocardless_id?: string;
  };
  [key: string]: any;
}

export default function GoCardlessPage() {
  const [rows, setRows] = useState<GoCardlessRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<GoCardlessRow>>({});
  const [lastSyncDate, setLastSyncDate] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set([
      "id",
      "date",
      "description",
      "amount",
      "type",
      "status",
      "reconciliation",
      "actions",
    ])
  );
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false);
  const [tempVisibleColumns, setTempVisibleColumns] = useState<Set<string>>(
    new Set()
  );

  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadLastSyncDate = async () => {
    try {
      const { data, error } = await supabase
        .from("csv_rows")
        .select("created_at")
        .eq("source", "gocardless")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setLastSyncDate(formatTimestamp(new Date(data[0].created_at)));
      }
    } catch (error) {
      console.error("Error loading last sync date:", error);
    }
  };

  const openColumnSelector = () => {
    setTempVisibleColumns(new Set(visibleColumns));
    setColumnSelectorOpen(true);
  };

  const cancelColumnSelection = () => {
    setTempVisibleColumns(new Set());
    setColumnSelectorOpen(false);
  };

  const applyColumnSelection = () => {
    setVisibleColumns(new Set(tempVisibleColumns));
    setColumnSelectorOpen(false);
  };

  const toggleTempColumn = (column: string) => {
    const newSet = new Set(tempVisibleColumns);
    if (newSet.has(column)) {
      newSet.delete(column);
    } else {
      newSet.add(column);
    }
    setTempVisibleColumns(newSet);
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
        .eq("source", "gocardless")
        .order("date", { ascending: false })
        .limit(500);

      if (error) {
        console.error("Error loading data:", error);
        setRows([]);
        setIsLoading(false);
        return;
      }

      if (!rowsData || rowsData.length === 0) {
        console.log("No data found");
        setRows([]);
        setIsLoading(false);
        return;
      }

      const mappedRows: GoCardlessRow[] = rowsData.map((row) => ({
        id: row.id,
        date: row.date,
        description: row.description || "",
        amount: parseFloat(row.amount) || 0,
        reconciled: row.reconciled || false,
        custom_data: row.custom_data || {},
      }));

      setRows(mappedRows);
      await loadLastSyncDate();
    } catch (error) {
      console.error("Error loading data:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/gocardless/sync", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        await loadData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Error syncing with GoCardless API");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconcile = async (row: GoCardlessRow) => {
    try {
      const { error } = await supabase
        .from("csv_rows")
        .update({
          reconciled: !row.reconciled,
        })
        .eq("id", row.id);

      if (!error) {
        const updatedRows = rows.map((r) =>
          r.id === row.id ? { ...r, reconciled: !r.reconciled } : r
        );
        setRows(updatedRows);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error updating reconciliation:", error);
      alert("Error updating reconciliation status");
    }
  };

  const startEditing = (row: GoCardlessRow) => {
    setEditingRow(row.id);
    setEditedData({ ...row });
  };

  const saveEdit = async () => {
    if (!editingRow) return;

    const updatedRows = rows.map((row) =>
      row.id === editingRow ? { ...row, ...editedData } : row
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
          })
          .eq("id", rowToUpdate.id);

        if (error) {
          console.error("Update error:", error);
          alert("Error saving changes");
          return;
        }

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        console.error("Error saving edit:", error);
        alert("Error saving changes");
      }
    }

    setEditingRow(null);
    setEditedData({});
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };

  let filteredRows = rows;

  if (searchTerm) {
    filteredRows = filteredRows.filter(
      (row) =>
        row.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  if (typeFilter) {
    filteredRows = filteredRows.filter(
      (row) => row.custom_data?.type === typeFilter
    );
  }

  filteredRows.sort((a, b) => {
    let aValue = a[sortField as keyof GoCardlessRow];
    let bValue = b[sortField as keyof GoCardlessRow];

    if (sortField === "date") {
      aValue = new Date(a.date).getTime();
      bValue = new Date(b.date).getTime();
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    }

    const aStr = String(aValue || "").toLowerCase();
    const bStr = String(bValue || "").toLowerCase();

    return sortDirection === "asc"
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  const totalAmount = filteredRows.reduce((sum, row) => sum + row.amount, 0);
  const reconciledAmount = filteredRows
    .filter((row) => row.reconciled)
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/reports">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GoCardless</h1>
              <p className="text-gray-600">Direct Debit & Payment Management</p>
            </div>
          </div>
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="bg-[#0B9CFF] hover:bg-[#0988FF] text-white gap-2"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Sync className="w-4 h-4" />
                Sync API
              </>
            )}
          </Button>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 ml-2">
              Changes saved successfully
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredRows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(totalAmount)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Reconciled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredRows.filter((r) => r.reconciled).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Last Sync
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-mono text-gray-600">
                {lastSyncDate || "Never"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters & Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by description or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={typeFilter || ""} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="payout">Payouts</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                </SelectContent>
              </Select>
              <Dialog
                open={columnSelectorOpen}
                onOpenChange={setColumnSelectorOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={openColumnSelector}
                    className="gap-2"
                  >
                    <Columns3 className="w-4 h-4" />
                    Columns
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Columns to Display</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2">
                    {[
                      "id",
                      "date",
                      "description",
                      "amount",
                      "type",
                      "status",
                      "reconciliation",
                      "actions",
                    ].map((col) => (
                      <div key={col} className="flex items-center gap-2">
                        <Checkbox
                          id={col}
                          checked={tempVisibleColumns.has(col)}
                          onCheckedChange={() => toggleTempColumn(col)}
                        />
                        <label
                          htmlFor={col}
                          className="cursor-pointer capitalize"
                        >
                          {col}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={cancelColumnSelection}
                    >
                      Cancel
                    </Button>
                    <Button onClick={applyColumnSelection}>Apply</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {isLoading ? (
          <Card>
            <CardContent className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </CardContent>
          </Card>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="flex justify-center items-center h-32">
              <p className="text-gray-500">
                No transactions found. Click "Sync API" to load data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {visibleColumns.has("id") && (
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        ID
                      </th>
                    )}
                    {visibleColumns.has("date") && (
                      <th
                        className="px-4 py-3 text-left font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          setSortField("date");
                          setSortDirection(
                            sortDirection === "asc" ? "desc" : "asc"
                          );
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Date
                          {sortField === "date" && (
                            <ArrowUpDown className="w-4 h-4" />
                          )}
                        </div>
                      </th>
                    )}
                    {visibleColumns.has("description") && (
                      <th className="px-4 py-3 text-left font-medium text-gray-700">
                        Description
                      </th>
                    )}
                    {visibleColumns.has("amount") && (
                      <th className="px-4 py-3 text-right font-medium text-gray-700">
                        Amount
                      </th>
                    )}
                    {visibleColumns.has("type") && (
                      <th className="px-4 py-3 text-center font-medium text-gray-700">
                        Type
                      </th>
                    )}
                    {visibleColumns.has("status") && (
                      <th className="px-4 py-3 text-center font-medium text-gray-700">
                        Status
                      </th>
                    )}
                    {visibleColumns.has("reconciliation") && (
                      <th className="px-4 py-3 text-center font-medium text-gray-700">
                        Reconciled
                      </th>
                    )}
                    {visibleColumns.has("actions") && (
                      <th className="px-4 py-3 text-center font-medium text-gray-700">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      {visibleColumns.has("id") && (
                        <td className="px-4 py-3 font-mono text-gray-600">
                          {row.id}
                        </td>
                      )}
                      {visibleColumns.has("date") && (
                        <td className="px-4 py-3">
                          {editingRow === row.id ? (
                            <input
                              type="date"
                              value={editedData.date || row.date}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  date: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded text-sm w-full"
                            />
                          ) : (
                            formatDate(new Date(row.date))
                          )}
                        </td>
                      )}
                      {visibleColumns.has("description") && (
                        <td className="px-4 py-3">
                          {editingRow === row.id ? (
                            <input
                              type="text"
                              value={
                                editedData.description || row.description
                              }
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  description: e.target.value,
                                })
                              }
                              className="px-2 py-1 border rounded text-sm w-full"
                            />
                          ) : (
                            row.description
                          )}
                        </td>
                      )}
                      {visibleColumns.has("amount") && (
                        <td className="px-4 py-3 text-right font-semibold">
                          {editingRow === row.id ? (
                            <input
                              type="number"
                              value={editedData.amount || row.amount}
                              onChange={(e) =>
                                setEditedData({
                                  ...editedData,
                                  amount: parseFloat(e.target.value),
                                })
                              }
                              step="0.01"
                              className="px-2 py-1 border rounded text-sm w-full text-right"
                            />
                          ) : (
                            formatCurrency(row.amount)
                          )}
                        </td>
                      )}
                      {visibleColumns.has("type") && (
                        <td className="px-4 py-3 text-center">
                          <Badge variant="outline">
                            {row.custom_data?.type || "unknown"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.has("status") && (
                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={
                              row.custom_data?.status === "paid"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }
                          >
                            {row.custom_data?.status || "unknown"}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.has("reconciliation") && (
                        <td className="px-4 py-3 text-center">
                          {row.reconciled ? (
                            <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                          )}
                        </td>
                      )}
                      {visibleColumns.has("actions") && (
                        <td className="px-4 py-3 text-center">
                          {editingRow === row.id ? (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={saveEdit}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={cancelEdit}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditing(row)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  row.reconciled ? "default" : "outline"
                                }
                                onClick={() => handleReconcile(row)}
                              >
                                {row.reconciled ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CardContent className="border-t pt-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing {filteredRows.length} of {rows.length} transactions
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  Total: {formatCurrency(totalAmount)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
