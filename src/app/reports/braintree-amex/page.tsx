"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle, Settings, Database, XIcon, Zap, User } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/custom/sidebar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { formatDate, formatCurrency, formatTimestamp } from "@/lib/formatters"

interface BraintreeAmexRow {
  id: string
  date: string
  description: string
  amount: number
  conciliado: boolean
  destinationAccount: string | null
  reconciliationType?: 'automatic' | 'manual' | null
  [key: string]: any
}

export default function BraintreeAmexPage() {
  const [rows, setRows] = useState<BraintreeAmexRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("csv_rows")
        .select("*")
        .eq("source", "braintree-amex")
        .order("date", { ascending: true })

      if (error) {
        console.error("Erro ao carregar dados do Braintree Amex:", error)
        setRows([])
      } else {
        const mapped = data.map((row) => ({
          id: row.id,
          date: row.date,
          description: row.description,
          amount: parseFloat(row.amount),
          conciliado: row.custom_data?.conciliado || false,
          destinationAccount: row.custom_data?.destinationAccount || null,
          reconciliationType: row.custom_data?.reconciliationType || null,
        }))
        setRows(mapped)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Sidebar currentPage="braintree-amex" paymentSourceDates={{}} />
      <div className="md:pl-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Braintree Amex - Payment Source</h1>
            <p className="text-sm text-slate-500 dark:text-slate-300">{rows.length} registros carregados</p>
          </div>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Resumo dos Pagamentos</CardTitle>
            <CardDescription>
              Dados importados via CSV da fonte <code>braintree-amex</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">ID</th>
                  <th className="text-left py-3 px-4 font-semibold">Data</th>
                  <th className="text-left py-3 px-4 font-semibold">Descrição</th>
                  <th className="text-right py-3 px-4 font-semibold">Valor</th>
                  <th className="text-center py-3 px-4 font-semibold">Conciliado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 dark:border-slate-700">
                    <td className="py-3 px-4 font-mono text-xs">{row.id.substring(0, 8)}...</td>
                    <td className="py-3 px-4">{formatDate(row.date)}</td>
                    <td className="py-3 px-4">{row.description}</td>
                    <td className="py-3 px-4 text-right font-semibold text-blue-600">{formatCurrency(row.amount)}</td>
                    <td className="py-3 px-4 text-center">
                      {row.conciliado ? (
                        <CheckCircle className="h-5 w-5 text-green-500 inline" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-400 inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
