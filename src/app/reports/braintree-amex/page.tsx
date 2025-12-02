"use client";

import { useState, useEffect } from "react";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Trash2,
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
import { Sidebar } from "@/components/custom/sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface BraintreeAmexRow {
  id: string;
  disbursement_date: string;
  payout: number;
  transaction_id: string;
  currency_iso_code: string;
  amount_authorized: number;
  customer_name: string;
  bank_conciliation: boolean;
  braintree_amex_conciliation: boolean;
  [key: string]: any;
}

export default function BraintreeAmexPage() {
  const [rows, setRows] = useState<BraintreeAmexRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("csv_files")
        .select("rows")
        .eq("source", "braintree-amex")
        .single();
      if (error) throw error;
      if (data?.rows) setRows(data.rows as BraintreeAmexRow[]);
      else setRows([]);
    } catch (error) {
      console.error("Erro ao carregar dados Amex:", error);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim() !== "");
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""));

      const newRows: BraintreeAmexRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]
          .split(",")
          .map((v) => v.trim().replace(/^"|"$/g, ""));
        const row: any = {};
        headers.forEach((h, j) => (row[h] = values[j] || ""));

        newRows.push({
          id: `BT-AMEX-${i.toString().padStart(4, "0")}`,
          disbursement_date: row["Settlement Date"] || "",
          payout: parseFloat(row["Payout"] || "0"),
          transaction_id: row["Transaction ID"] || "",
          currency_iso_code: row["Currency ISO Code"] || "USD",
          amount_authorized: parseFloat(row["Amount Authorized"] || "0"),
          customer_name: row["Customer Name"] || "",
          bank_conciliation: false,
          braintree_amex_conciliation: false,
        });
      }

      await supabase.from("csv_files").upsert({
        source: "braintree-amex",
        rows: newRows,
        lastUpdate: new Date().toISOString(),
      });

      setRows(newRows);
      alert("✅ Upload Amex concluído com sucesso!");
    };

    reader.readAsText(file);
  };

  const handleDeleteAll = async () => {
    if (!confirm("Tem certeza que deseja excluir todos os registros Amex?"))
      return;

    setIsDeleting(true);
    try {
      await supabase.from("csv_files").delete().eq("source", "braintree-amex");
      setRows([]);
      alert("🗑️ Todos os registros Amex foram removidos.");
    } catch (error) {
      console.error("Erro ao deletar registros:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-100">
      <Sidebar currentPage="braintree-amex" paymentSourceDates={{}} />

      <div className="md:pl-64 p-6">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-[#1a2b4a]">
              Braintree Amex — Transações
            </h1>
          </div>

          <div className="flex gap-2">
            <input
              id="file-upload-amex"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="file-upload-amex">
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" /> Upload CSV
              </Button>
            </label>

            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Deletar Tudo
            </Button>
          </div>
        </header>

        <Card className="shadow-xl">
          <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
            <CardTitle>Todas as transações Amex</CardTitle>
            <CardDescription>Gerencie uploads e pagamentos CSV</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b">
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-left">Valor</th>
                    <th className="p-3 text-left">Transação</th>
                    <th className="p-3 text-left">Moeda</th>
                    <th className="p-3 text-left">Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b hover:bg-gray-50 transition"
                    >
                      <td className="p-3 font-bold">{row.id}</td>
                      <td className="p-3">{row.disbursement_date}</td>
                      <td className="p-3 text-right">
                        {row.payout.toFixed(2)}
                      </td>
                      <td className="p-3">{row.transaction_id}</td>
                      <td className="p-3">{row.currency_iso_code}</td>
                      <td className="p-3">{row.customer_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
