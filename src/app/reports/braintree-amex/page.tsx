// src/components/reports/BraintreePage.tsx
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

interface BraintreeRow {
  id: string
  date: string
  description: string
  amount: number
  conciliado: boolean
  destinationAccount: string | null
  reconciliationType?: 'automatic' | 'manual' | null
  [key: string]: any
}

interface Props {
  source: string
  title: string
}

export default function BraintreePage({ source, title }: Props) {
  const [rows, setRows] = useState<BraintreeRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchRows = async () => {
      const { data, error } = await supabase
        .from('csv_rows')
        .select('*')
        .eq('source', source)
        .order('date', { ascending: true })

      if (error) console.error(error)
      else if (data) {
        setRows(data.map(row => ({
          id: row.id,
          date: row.date,
          description: row.description,
          amount: parseFloat(row.amount),
          conciliado: row.custom_data?.conciliado || false,
          destinationAccount: row.custom_data?.destinationAccount || null,
          reconciliationType: row.custom_data?.reconciliationType || null,
        })))
      }
      setIsLoading(false)
    }

    fetchRows()
  }, [source])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Sidebar currentPage={source} paymentSourceDates={{}} />
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
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">{title}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Payment Source Details</CardTitle>
              <CardDescription className="text-white/80">
                Upload CSV files - Columns: disbursement_date → Date | settlement_currency_sales → Amount (Payout calculated automatically)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm">ID</th>
                      <th className="text-left py-4 px-4 font-bold text-sm">Date</th>
                      <th className="text-left py-4 px-4 font-bold text-sm">Description</th>
                      <th className="text-right py-4 px-4 font-bold text-sm">Amount</th>
                      <th className="text-center py-4 px-4 font-bold text-sm">Destination Account</th>
                      <th className="text-center py-4 px-4 font-bold text-sm">Payout Reconciliation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-gray-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-sm font-bold">{row.id.substring(0, 8)}...</td>
                        <td className="py-3 px-4 text-sm">{formatDate(row.date)}</td>
                        <td className="py-3 px-4 text-sm max-w-xs truncate">{row.description}</td>
                        <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">{formatCurrency(row.amount)}</td>
                        <td className="py-3 px-4 text-center text-sm">
                          {row.destinationAccount || <span className="text-gray-400 text-xs">N/A</span>}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.conciliado ? (
                            <Zap className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-gray-400 mx-auto" />
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
  )
}
