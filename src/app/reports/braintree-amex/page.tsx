// Fully replicated and synchronized from braintree-eur for braintree-amex
"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle, Settings, Database, XIcon, Zap, User } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/custom/sidebar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "EUR" })
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 16)
}

function isWithinDateRange(date1: string, date2: string, dayRange = 3): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diff = Math.abs(d2.getTime() - d1.getTime())
  return diff <= dayRange * 86400000
}

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

interface BankStatementRow {
  date: string
  amount: number
  source: string
}

async function reconcileBankStatements(rows: BraintreeAmexRow[]): Promise<BraintreeAmexRow[]> {
  const { data, error } = await supabase
    .from("csv_rows")
    .select("*")
    .like("source", "bankinter-%")

  if (error || !data) {
    console.error("Erro ao carregar extratos bancários:", error)
    return rows
  }

  const bankStatements: BankStatementRow[] = data.map(row => ({
    date: row.date,
    amount: parseFloat(row.amount) || 0,
    source: row.source === 'bankinter-eur' ? 'Bankinter EUR' : row.source === 'bankinter-usd' ? 'Bankinter USD' : 'Bankinter'
  }))

  return rows.map(braintreeRow => {
    const matches = bankStatements.filter(bs => isWithinDateRange(braintreeRow.date, bs.date))
    const exact = matches.find(bs => Math.abs(bs.amount - braintreeRow.amount) < 0.01)

    if (exact) {
      return {
        ...braintreeRow,
        destinationAccount: exact.source,
        conciliado: true,
        reconciliationType: 'automatic'
      }
    }

    const accountGroups = new Map<string, number>()
    matches.forEach(bs => {
      const sum = accountGroups.get(bs.source) || 0
      accountGroups.set(bs.source, sum + bs.amount)
    })

    for (const [account, total] of accountGroups.entries()) {
      if (Math.abs(total - braintreeRow.amount) < 0.01) {
        return {
          ...braintreeRow,
          destinationAccount: account,
          conciliado: true,
          reconciliationType: 'automatic'
        }
      }
    }

    return {
      ...braintreeRow,
      destinationAccount: null,
      conciliado: false,
      reconciliationType: null
    }
  })
}

export default function BraintreeAmexPage() {
  const [rows, setRows] = useState<BraintreeAmexRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
        const reconciled = await reconcileBankStatements(mapped)
        setRows(reconciled)
      }
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const saveAllChanges = async () => {
    setIsSaving(true)
    try {
      const payload = rows.map(row => ({
        id: row.id,
        file_name: 'braintree-amex.csv',
        source: 'braintree-amex',
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: 'Other',
        classification: 'Other',
        reconciled: row.conciliado,
        custom_data: {
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          conciliado: row.conciliado,
          destinationAccount: row.destinationAccount,
          reconciliationType: row.reconciliationType
        }
      }))

      const response = await fetch('/api/csv-rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload, source: 'braintree-amex' })
      })

      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'Unknown error')

      const now = new Date()
      setLastSaved(formatTimestamp(now))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Erro ao salvar dados:', err)
      alert('Erro ao salvar os dados.')
    } finally {
      setIsSaving(false)
    }
  }

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
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button onClick={saveAllChanges} disabled={isSaving} className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Save All Changes
            </Button>
            <Button variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
            <Button className="gap-2 bg-[#1a2b4a] text-white">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>

        {saveSuccess && (
          <Alert className="mb-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
              ✅ All changes saved successfully! Last saved: {lastSaved}
            </AlertDescription>
          </Alert>
        )}

        <Card className="shadow-md">
          <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
            <CardTitle>Resumo dos Pagamentos</CardTitle>
            <CardDescription className="text-white/80">
              Upload CSV files - Columns: disbursement_date → Date | settlement_currency_sales → Amount
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
