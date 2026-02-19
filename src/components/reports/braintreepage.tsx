// src/components/reports/BraintreePage.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
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
import Sidebar from "@/components/custom/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { formatDate, formatCurrency, formatTimestamp } from "@/lib/formatters";

interface BraintreeRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  conciliado: boolean;
  destinationAccount: string | null;
  reconciliationType?: "automatic" | "manual" | null;
  [key: string]: any;
}

interface Props {
  source: string;
  title: string;
}

export default function BraintreePage({ source, title }: Props) {
  const [rows, setRows] = useState<BraintreeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchRows = async () => {
      try {
        if (!supabase) {
          console.error("Supabase client not configured.");
          setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from("csv_rows")
          .select("*")
          .eq("source", source)
          .order("date", { ascending: true });

        if (error) console.error(error);
        else if (data) {
          setRows(
            data.map((row) => ({
              id: row.id,
              date: row.date,
              description: row.description,
              amount: parseFloat(row.amount),
              conciliado: row.custom_data?.conciliado || false,
              destinationAccount: row.custom_data?.destinationAccount || null,
              reconciliationType: row.custom_data?.reconciliationType || null,
            })),
          );
        }
      } catch (error) {
        console.error("Error fetching rows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRows();
  }, [source, supabase]);

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Date",
      "Description",
      "Amount",
      "Destination Account",
      "Conciliado",
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
    a.download = `${source}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const uploadCSV = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = async (event: any) => {
      const client = supabase;
      if (!client) {
        console.error("Supabase client not configured.");
        return;
      }

      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split("\n").filter(Boolean);
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

        const dateIdx = headers.findIndex((h) =>
          ["fecha contable", "fecha valor", "date"].includes(h),
        );
        const descIdx = headers.findIndex((h) =>
          ["descripción", "descripcion", "description"].includes(h),
        );
        const amountIdx = headers.findIndex((h) =>
          ["haber", "importe", "amount"].includes(h),
        );

        if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
          alert(
            "❌ Arquivo inválido. É necessário conter colunas: Data, Descrição e Valor",
          );
          return;
        }

        const newRows: BraintreeRow[] = lines.slice(1).map((line, idx) => {
          const values = line.split(",");
          return {
            id: `${source}-${Date.now()}-${idx}`,
            date: values[dateIdx],
            description: values[descIdx],
            amount: parseFloat(values[amountIdx]) || 0,
            conciliado: false,
            destinationAccount: null,
            reconciliationType: null,
          };
        });

        const { error } = await client.from("csv_rows").insert(
          newRows.map((row) => ({
            id: row.id,
            source,
            date: row.date,
            description: row.description,
            amount: row.amount.toString(),
            category: "Other",
            classification: "Other",
            reconciled: false,
            custom_data: {
              conciliado: row.conciliado,
              destinationAccount: row.destinationAccount,
              reconciliationType: row.reconciliationType,
            },
          })),
        );

        if (error) {
          console.error(error);
        } else {
          setRows((prev) => [...prev, ...newRows]);
          const now = new Date();
          setLastSaved(formatTimestamp(now));
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <Sidebar />
      <div className="md:pl-64">
        <header className="bg-white dark:bg-[#1a2b4a] shadow sticky top-0 z-30">
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
                    {title}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={uploadCSV} variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" /> Upload
                </Button>
                <Button
                  onClick={exportToCSV}
                  className="gap-2 bg-blue-600 dark:bg-[#1a2b4a] text-white"
                >
                  <Download className="h-4 w-4" /> Download
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
          </div>
        </header>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-[#1a2b4a] dark:to-[#2c3e5f] text-white">
              <CardTitle>Payment Source Details</CardTitle>
              <CardDescription className="text-blue-100 dark:text-white/80">
                Data for: <code>{source}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-black">
                      <th className="text-left py-4 px-4 font-bold text-sm">
                        ID
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm">
                        Date
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-sm">
                        Description
                      </th>
                      <th className="text-right py-4 px-4 font-bold text-sm">
                        Amount
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm">
                        Destination Account
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-sm">
                        Payout Reconciliation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-[#111111]/50"
                      >
                        <td className="py-3 px-4 text-sm font-bold">
                          {row.id.substring(0, 8)}...
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-3 px-4 text-sm max-w-xs truncate">
                          {row.description}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
                          {formatCurrency(row.amount)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">
                          {row.destinationAccount || (
                            <span className="text-gray-500 dark:text-gray-400 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.conciliado ? (
                            <Zap className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mx-auto" />
                          )}
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
