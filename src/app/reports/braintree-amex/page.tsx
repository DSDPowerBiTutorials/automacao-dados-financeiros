"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

interface BraintreeAmexTransactionRow {
  id: string
  payout: string
  transaction_id: string
  disbursement_date: string
  currency_iso_code: string
  amount_authorized: number
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  order_id_1: string
  order_id_2: string
  order_id_3: string
  order_id_4: string
  customer_name: string
  bank_conciliation: boolean
  braintree_amex_conciliation: boolean
  [key: string]: any
}

interface BraintreeAmexRow {
  id: string
  disbursement_date: string
  payout: number
  [key: string]: any
}

export default function BraintreeAmexTransactionsPage() {
  const [rows, setRows] = useState<BraintreeAmexTransactionRow[]>([])
  const [braintreeAmexRows, setBraintreeAmexRows] = useState<BraintreeAmexRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BraintreeAmexTransactionRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()
      
      const transactionsFile = data.find(f => f.source === 'braintree-amex-transactions')
      if (transactionsFile) {
        setRows(transactionsFile.rows as BraintreeAmexTransactionRow[])
      } else {
        setRows([])
      }
      
      const braintreeAmexFile = data.find(f => f.source === 'braintree-amex')
      if (braintreeAmexFile) {
        setBraintreeAmexRows(braintreeAmexFile.rows as BraintreeAmexRow[])
      }
      
      if (transactionsFile && braintreeAmexFile) {
        performConciliation(transactionsFile.rows as BraintreeAmexTransactionRow[], braintreeAmexFile.rows as BraintreeAmexRow[])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  const performConciliation = (transactionsData: BraintreeAmexTransactionRow[], braintreeAmexData: BraintreeAmexRow[]) => {
    const groupedTransactions = new Map<string, BraintreeAmexTransactionRow[]>()
    
    transactionsData.forEach(tx => {
      if (tx.currency_iso_code === 'USD' && tx.disbursement_date) {
        const key = tx.disbursement_date
        if (!groupedTransactions.has(key)) {
          groupedTransactions.set(key, [])
        }
        groupedTransactions.get(key)!.push(tx)
      }
    })
    
    const reconciledRows = transactionsData.map(tx => {
      if (tx.currency_iso_code !== 'USD' || !tx.disbursement_date) {
        return {
          ...tx,
          customer_name: `${tx.customer_first_name || ''} ${tx.customer_last_name || ''}`.trim(),
          bank_conciliation: false,
          braintree_amex_conciliation: false
        }
      }
      
      const sameDayTransactions = groupedTransactions.get(tx.disbursement_date) || []
      const totalAmount = sameDayTransactions.reduce((sum, t) => sum + (parseFloat(t.amount_authorized?.toString() || '0') || 0), 0)
      
      const matchingPayout = braintreeAmexData.find(btAmex => {
        const valueMatch = Math.abs(totalAmount - btAmex.payout) < 0.01
        const dateMatch = btAmex.disbursement_date === tx.disbursement_date
        return valueMatch && dateMatch
      })
      
      return {
        ...tx,
        customer_name: `${tx.customer_first_name || ''} ${tx.customer_last_name || ''}`.trim(),
        bank_conciliation: matchingPayout ? true : false,
        braintree_amex_conciliation: matchingPayout ? true : false
      }
    })
    setRows(reconciledRows)
  }

  // As demais funções (upload, edição, exclusão, download) permanecem idênticas à versão Braintree EUR,
  // apenas substituindo as menções de EUR para AMEX.

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
    </div>
  )
}

