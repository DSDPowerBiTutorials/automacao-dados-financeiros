"use client"

import { useState, useEffect } from "react"
import { Upload, FileSpreadsheet, Download, Edit2, Save, X, Calendar, CheckCircle, AlertCircle, Building2, CreditCard, Wallet, ArrowRightLeft, Settings, Plus, Trash2, TrendingUp, DollarSign, Loader2, Database, Search, ArrowUpDown } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow, deleteAllReports } from "@/lib/database"
import { downloadFinalCSV, downloadIndividualCSV } from "@/lib/download-helpers"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/custom/sidebar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface CSVRow {
  id: string
  date: string
  description: string
  amount: number
  category: string
  classification: string
  source: string
  depositAccount?: string // Para gateways de pagamento
  paymentMethod?: string // Para Bankinter - de onde veio o dinheiro
  orderNumbers?: string[] // MÚLTIPLAS ordens de compra
  reconciled?: boolean
  matchedWith?: string
  [key: string]: any // Para colunas customizadas
}

interface CSVFile {
  name: string
  lastUpdated: string
  rows: CSVRow[]
  totalAmount: number
  source: 'sabadell' | 'braintree-eur' | 'braintree-usd' | 'braintree-transactions' | 'braintree-amex' | 'braintree-amex-transactions' | 'stripe' | 'gocardless' | 'paypal'
}

interface CustomColumn {
  id: string
  name: string
  type: 'text' | 'select' | 'number'
  options?: string[] // Para tipo select
}

type SortField = 'id' | 'date' | null
type SortDirection = 'asc' | 'desc'

type DateFilterType = 'current-week' | 'previous-week' | 'current-month' | 'last-month' | 'current-year' | 'last-year' | 'custom' | 'all'

export default function Home() {
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Filtros e ordenação
  const [searchOrderNumber, setSearchOrderNumber] = useState("")
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all')
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  // Carregar dados do Supabase ao iniciar
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()
      if (data && data.length > 0) {
        setCsvFiles(data)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Função para salvar TODOS os dados manualmente
  const saveAllData = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      // Salvar todos os arquivos CSV
      for (const file of csvFiles) {
        await saveCSVFile(file)
      }
      
      // Atualizar timestamp de último salvamento
      const now = new Date()
      const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setLastSaved(formattedTime)
      setSaveSuccess(true)
      
      // Esconder mensagem de sucesso após 3 segundos
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving all data:', error)
      alert('Error saving data. Please check your Supabase configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedCategory, setEditedCategory] = useState<string>("")
  const [editedClassification, setEditedClassification] = useState<string>("")
  const [editedDepositAccount, setEditedDepositAccount] = useState<string>("")
  const [editedPaymentMethod, setEditedPaymentMethod] = useState<string>("")
  const [editedOrderNumbers, setEditedOrderNumbers] = useState<string[]>([])
  const [newOrderInput, setNewOrderInput] = useState<string>("")

  // Settings state
  const [classificationOptions, setClassificationOptions] = useState<string[]>([
    "Client Payment",
    "Online Payment",
    "Subscription",
    "Invoice Payment",
    "Investment",
    "Bank Fees",
    "Payment Fees",
    "Rent",
    "Supplies",
    "Refund",
    "Bank Transfer",
    "Salary",
    "Utilities",
    "Marketing",
    "Other"
  ])

  const [categoryOptions] = useState<string[]>([
    "Revenue",
    "Expense",
    "Other"
  ])

  const [depositAccountOptions, setDepositAccountOptions] = useState<string[]>([
    "Braintree",
    "Stripe",
    "GoCardless"
  ])

  const [paymentMethodOptions, setPaymentMethodOptions] = useState<string[]>([
    "Braintree",
    "Stripe",
    "GoCardless",
    "Direct Transfer",
    "Other"
  ])

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([])

  // Settings dialog states
  const [newClassification, setNewClassification] = useState("")
  const [newPaymentMethod, setNewPaymentMethod] = useState("")
  const [newDepositAccount, setNewDepositAccount] = useState("")
  const [newColumnName, setNewColumnName] = useState("")
  const [newColumnType, setNewColumnType] = useState<'text' | 'select' | 'number'>('text')
  const [newColumnOptions, setNewColumnOptions] = useState("")

  // Função para converter QUALQUER formato de data para DD/MM/YYYY
  const convertDateFormat = (dateString: string): string => {
    if (!dateString) return ""
    
    // Remove espaços e pega apenas a parte da data (ignora hora se existir)
    const cleanDate = dateString.trim().split(' ')[0]
    
    // Tenta parsear diferentes formatos
    let day: number, month: number, year: number
    
    // Formato YYYY-MM-DD (ISO)
    if (cleanDate.includes('-') && cleanDate.split('-')[0].length === 4) {
      const parts = cleanDate.split('-')
      year = parseInt(parts[0])
      month = parseInt(parts[1])
      day = parseInt(parts[2])
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
    }
    
    // Formato com barras
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/')
      if (parts.length === 3) {
        const first = parseInt(parts[0])
        const second = parseInt(parts[1])
        const third = parseInt(parts[2])
        
        // Detecta se é DD/MM/YYYY ou MM/DD/YYYY
        if (first <= 31 && first > 0 && second <= 12 && second > 0) {
          // Já está no formato DD/MM/YYYY
          day = first
          month = second
          year = third
        } else if (first <= 12 && second <= 31 && second > 0) {
          // É MM/DD/YYYY - converter para DD/MM/YYYY
          month = first
          day = second
          year = third
        } else {
          return cleanDate // Não conseguiu identificar
        }
        
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
      }
    }
    
    return cleanDate
  }

  // Função para limpar valores monetários (remove símbolos de moeda, espaços e vírgulas)
  const parseMonetaryValue = (value: string): number => {
    if (!value) return 0
    // Remove símbolos de moeda (€, $, etc), espaços e vírgulas de milhares
    const cleaned = value.toString().replace(/[€$£¥\s,]/g, '').trim()
    // Substitui vírgula decimal por ponto se necessário
    const normalized = cleaned.replace(/,(\d{2})$/, '.$1')
    return parseFloat(normalized) || 0
  }

  // Função para converter data DD/MM/YYYY para Date object
  const parseDate = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('/').map(Number)
    return new Date(year, month - 1, day)
  }

  // Função para filtrar por data
  const filterByDate = (rows: CSVRow[]): CSVRow[] => {
    if (dateFilter === 'all') return rows

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let startDate: Date
    let endDate: Date = new Date(today)
    endDate.setHours(23, 59, 59, 999)

    switch (dateFilter) {
      case 'current-week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay())
        break
      case 'previous-week':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay() - 7)
        endDate = new Date(today)
        endDate.setDate(today.getDate() - today.getDay() - 1)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'current-month':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case 'last-month':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        endDate = new Date(today.getFullYear(), today.getMonth(), 0)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'current-year':
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      case 'last-year':
        startDate = new Date(today.getFullYear() - 1, 0, 1)
        endDate = new Date(today.getFullYear() - 1, 11, 31)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'custom':
        if (!customStartDate || !customEndDate) return rows
        startDate = new Date(customStartDate)
        endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
        break
      default:
        return rows
    }

    return rows.filter(row => {
      const rowDate = parseDate(row.date)
      return rowDate >= startDate && rowDate <= endDate
    })
  }

  // Função para filtrar e ordenar linhas
  const filterAndSortRows = (rows: CSVRow[]): CSVRow[] => {
    let filtered = [...rows]

    // Filtrar por order number
    if (searchOrderNumber.trim()) {
      filtered = filtered.filter(row => 
        row.orderNumbers?.some(order => 
          order.toLowerCase().includes(searchOrderNumber.toLowerCase())
        )
      )
    }

    // Filtrar por data
    filtered = filterByDate(filtered)

    // Ordenar
    if (sortField) {
      filtered.sort((a, b) => {
        let comparison = 0
        
        if (sortField === 'id') {
          comparison = a.id.localeCompare(b.id)
        } else if (sortField === 'date') {
          const dateA = parseDate(a.date)
          const dateB = parseDate(b.date)
          comparison = dateA.getTime() - dateB.getTime()
        }

        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }

  // Função para alternar ordenação
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, source: CSVFile['source']) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        
        const newRows: CSVRow[] = []
        
        // Gerar IDs sequenciais baseado no source
        const existingFile = csvFiles.find(f => f.source === source)
        let idCounter = existingFile ? existingFile.rows.length + 1 : 1
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
          const row: any = {}
          
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          
          // Processar baseado na fonte
          if (source === 'braintree-amex') {
            // Formato Braintree Amex - usar Settlement date como date e Amount Paid To Bank como payout
            const settlementDate = row['Settlement date'] ? convertDateFormat(row['Settlement date']) : convertDateFormat(new Date().toLocaleDateString('pt-BR'))
            
            // Pegar Amount Paid To Bank como payout
            const amountPaidToBank = parseMonetaryValue(row['Amount Paid To Bank'] || '0')
            
            // Processar múltiplas ordens (separadas por vírgula ou ponto-e-vírgula)
            const orderNumbersStr = row['Order ID'] || row['order_id'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: `BT-AMEX-${String(idCounter).padStart(3, '0')}`,
              date: settlementDate,
              description: `Braintree Amex Settlement - ${row['Settlement number'] || settlementDate}`,
              amount: amountPaidToBank,
              category: amountPaidToBank > 0 ? 'Revenue' : 'Expense',
              classification: 'Online Payment',
              source: 'Braintree Amex',
              depositAccount: 'Braintree',
              orderNumbers: orderNumbers,
              // Manter todas as colunas originais do CSV
              settlement_date: settlementDate,
              settlement_number: row['Settlement number'] || '',
              total_charges: parseMonetaryValue(row['Total charges'] || '0'),
              credits: parseMonetaryValue(row['Credits'] || '0'),
              submission_amount: parseMonetaryValue(row['Submission amount'] || '0'),
              discount_amount: parseMonetaryValue(row['Discount amount'] || '0'),
              fees_and_incentives: parseMonetaryValue(row['Fees and incentives'] || '0'),
              chargebacks: parseMonetaryValue(row['Chargebacks'] || '0'),
              adjustments: parseMonetaryValue(row['Adjustments'] || '0'),
              held_funds: parseMonetaryValue(row['Held Funds'] || '0'),
              settlement_amount: parseMonetaryValue(row['Settlement amount'] || '0'),
              settlement_currency_code: row['Settlement Currency Code'] || '',
              amount_paid_to_bank: amountPaidToBank
            })
            idCounter++
          } else if (source === 'stripe') {
            // Formato Stripe - usar automatic_payout_effective_at como date e net como amount
            const payoutDateRaw = row['automatic_payout_effective_at'] || ''
            const payoutDate = payoutDateRaw ? convertDateFormat(payoutDateRaw) : convertDateFormat(new Date().toLocaleDateString('pt-BR'))
            
            const netAmountRaw = row['net'] || '0'
            const netAmount = parseFloat(netAmountRaw) || 0
            
            // Processar múltiplas ordens (separadas por vírgula ou ponto-e-vírgula)
            const orderNumbersStr = row['Order ID'] || row['order_id'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: `ST-${String(idCounter).padStart(3, '0')}`,
              date: payoutDate,
              description: row['description'] || `Stripe Transaction - ${payoutDate}`,
              amount: netAmount,
              category: netAmount > 0 ? 'Revenue' : 'Expense',
              classification: 'Invoice Payment',
              source: 'Stripe',
              depositAccount: 'Stripe',
              orderNumbers: orderNumbers,
              // Manter todas as colunas originais do CSV
              ...row,
              automatic_payout_effective_at: payoutDate,
              net: netAmount
            })
            idCounter++
          } else if (source === 'gocardless') {
            // Formato GoCardless - usar payouts.arrival_date como date e net_amount como amount
            const arrivalDateRaw = row['payouts.arrival_date'] || ''
            const arrivalDate = arrivalDateRaw ? convertDateFormat(arrivalDateRaw) : convertDateFormat(new Date().toLocaleDateString('pt-BR'))
            
            const netAmountRaw = row['net_amount'] || '0'
            const netAmount = parseFloat(netAmountRaw) || 0
            
            // Processar múltiplas ordens (separadas por vírgula ou ponto-e-vírgula)
            const orderNumbersStr = row['Order ID'] || row['order_id'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: `GC-${String(idCounter).padStart(3, '0')}`,
              date: arrivalDate,
              description: row['resources.description'] || `GoCardless Payment - ${arrivalDate}`,
              amount: netAmount,
              category: netAmount > 0 ? 'Revenue' : 'Expense',
              classification: 'Subscription',
              source: 'GoCardless',
              depositAccount: 'GoCardless',
              orderNumbers: orderNumbers,
              // Manter todas as colunas originais do CSV
              ...row,
              'payouts.arrival_date': arrivalDate,
              net_amount: netAmount
            })
            idCounter++
          } else if (source === 'braintree-eur') {
            // Formato Braintree EUR - CSV com colunas específicas
            const disbursementDate = row['disbursement_date'] ? convertDateFormat(row['disbursement_date']) : convertDateFormat(new Date().toLocaleDateString('pt-BR'))
            
            // Calcular Payout (soma das colunas especificadas)
            const settlementSales = parseFloat(row['settlement_currency_sales_EUR']) || 0
            const discount = parseFloat(row['discount_EUR']) || 0
            const multicurrencyFees = parseFloat(row['multicurrency_fees_EUR']) || 0
            const perTransactionFees = parseFloat(row['per_transaction_fees_EUR']) || 0
            const crossBorderFees = parseFloat(row['cross_border_fees_EUR']) || 0
            const payout = settlementSales + discount + multicurrencyFees + perTransactionFees + crossBorderFees
            
            // Processar múltiplas ordens (separadas por vírgula ou ponto-e-vírgula)
            const orderNumbersStr = row['Order ID'] || row['order_id'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: `BT-EUR-${String(idCounter).padStart(3, '0')}`,
              date: disbursementDate,
              description: `Braintree EUR Disbursement - ${disbursementDate}`,
              amount: payout,
              category: payout > 0 ? 'Revenue' : 'Expense',
              classification: 'Online Payment',
              source: 'Braintree EUR',
              depositAccount: 'Braintree',
              orderNumbers: orderNumbers,
              // Manter todas as colunas originais do CSV
              disbursement_date: disbursementDate,
              settlement_currency_sales_EUR: settlementSales,
              discount_EUR: discount,
              multicurrency_fees_EUR: multicurrencyFees,
              per_transaction_fees_EUR: perTransactionFees,
              cross_border_fees_EUR: crossBorderFees,
              other_fees_EUR: parseFloat(row['other_fees_EUR']) || 0,
              chargebacks_lost_won_EUR: parseFloat(row['chargebacks_lost_won_EUR']) || 0,
              settlement_currency_refunds_EUR: parseFloat(row['settlement_currency_refunds_EUR']) || 0,
              '#_of_refunds': parseInt(row['#_of_refunds']) || 0,
              chargeback_won_amt_EUR: parseFloat(row['chargeback_won_amt_EUR']) || 0,
              '#_of_chargebacks_won': parseInt(row['#_of_chargebacks_won']) || 0,
              chargeback_issued_amt_EUR: parseFloat(row['chargeback_issued_amt_EUR']) || 0,
              '#_of_chargebacks_issued': parseInt(row['#_of_chargebacks_issued']) || 0,
              chargeback_fees_EUR: parseFloat(row['chargeback_fees_EUR']) || 0,
              payout: payout
            })
            idCounter++
          } else if (source === 'braintree-usd') {
            // Formato Braintree USD - MESMA LÓGICA DO EUR
            const disbursementDate = row['disbursement_date'] ? convertDateFormat(row['disbursement_date']) : convertDateFormat(new Date().toLocaleDateString('pt-BR'))
            
            // Calcular Payout (soma das colunas especificadas)
            // Suporta tanto colunas com sufixo _EUR quanto _USD para flexibilidade
            const settlementSales = parseFloat(row['settlement_currency_sales_EUR'] || row['settlement_currency_sales_USD']) || 0
            const discount = parseFloat(row['discount_EUR'] || row['discount_USD']) || 0
            const multicurrencyFees = parseFloat(row['multicurrency_fees_EUR'] || row['multicurrency_fees_USD']) || 0
            const perTransactionFees = parseFloat(row['per_transaction_fees_EUR'] || row['per_transaction_fees_USD']) || 0
            const crossBorderFees = parseFloat(row['cross_border_fees_EUR'] || row['cross_border_fees_USD']) || 0
            const payout = settlementSales + discount + multicurrencyFees + perTransactionFees + crossBorderFees
            
            // Processar múltiplas ordens (separadas por vírgula ou ponto-e-vírgula)
            const orderNumbersStr = row['Order ID'] || row['order_id'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: `BT-USD-${String(idCounter).padStart(3, '0')}`,
              date: disbursementDate,
              description: `Braintree USD Disbursement - ${disbursementDate}`,
              amount: payout,
              category: payout > 0 ? 'Revenue' : 'Expense',
              classification: 'Online Payment',
              source: 'Braintree USD',
              depositAccount: 'Braintree',
              orderNumbers: orderNumbers,
              // Manter todas as colunas originais do CSV (suporta ambos os formatos)
              disbursement_date: disbursementDate,
              settlement_currency_sales_EUR: row['settlement_currency_sales_EUR'] ? settlementSales : undefined,
              settlement_currency_sales_USD: row['settlement_currency_sales_USD'] ? settlementSales : undefined,
              discount_EUR: row['discount_EUR'] ? discount : undefined,
              discount_USD: row['discount_USD'] ? discount : undefined,
              multicurrency_fees_EUR: row['multicurrency_fees_EUR'] ? multicurrencyFees : undefined,
              multicurrency_fees_USD: row['multicurrency_fees_USD'] ? multicurrencyFees : undefined,
              per_transaction_fees_EUR: row['per_transaction_fees_EUR'] ? perTransactionFees : undefined,
              per_transaction_fees_USD: row['per_transaction_fees_USD'] ? perTransactionFees : undefined,
              cross_border_fees_EUR: row['cross_border_fees_EUR'] ? crossBorderFees : undefined,
              cross_border_fees_USD: row['cross_border_fees_USD'] ? crossBorderFees : undefined,
              other_fees_EUR: parseFloat(row['other_fees_EUR'] || row['other_fees_USD']) || 0,
              chargebacks_lost_won_EUR: parseFloat(row['chargebacks_lost_won_EUR'] || row['chargebacks_lost_won_USD']) || 0,
              settlement_currency_refunds_EUR: parseFloat(row['settlement_currency_refunds_EUR'] || row['settlement_currency_refunds_USD']) || 0,
              '#_of_refunds': parseInt(row['#_of_refunds']) || 0,
              chargeback_won_amt_EUR: parseFloat(row['chargeback_won_amt_EUR'] || row['chargeback_won_amt_USD']) || 0,
              '#_of_chargebacks_won': parseInt(row['#_of_chargebacks_won']) || 0,
              chargeback_issued_amt_EUR: parseFloat(row['chargeback_issued_amt_EUR'] || row['chargeback_issued_amt_USD']) || 0,
              '#_of_chargebacks_issued': parseInt(row['#_of_chargebacks_issued']) || 0,
              chargeback_fees_EUR: parseFloat(row['chargeback_fees_EUR'] || row['chargeback_fees_USD']) || 0,
              payout: payout
            })
            idCounter++
          } else {
            // Formato genérico - processar múltiplas ordens
            const orderNumbersStr = row['OrderNumber'] || row['OrderNumbers'] || ''
            const orderNumbers = orderNumbersStr ? orderNumbersStr.split(/[,;]/).map((o: string) => o.trim()).filter((o: string) => o) : []
            
            newRows.push({
              id: row['ID'] || `${source.toUpperCase()}-${String(idCounter).padStart(3, '0')}`,
              date: convertDateFormat(row['Date'] || new Date().toLocaleDateString('pt-BR')),
              description: row['Description'] || 'Transaction',
              amount: parseFloat(row['Amount']) || 0,
              category: row['Category'] || 'Other',
              classification: row['Classification'] || 'Other',
              source: source,
              depositAccount: row['DepositAccount'] || '',
              paymentMethod: row['PaymentMethod'] || '',
              orderNumbers: orderNumbers,
              ...row
            })
            idCounter++
          }
        }
        
        // Atualizar ou adicionar arquivo
        const existingFileIndex = csvFiles.findIndex(f => f.source === source)
        const totalAmount = newRows.reduce((sum, row) => sum + row.amount, 0)
        const today = new Date()
        const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
        
        const newFile: CSVFile = {
          name: file.name,
          lastUpdated: formattedDate,
          rows: newRows,
          totalAmount: totalAmount,
          source: source
        }
        
        if (existingFileIndex >= 0) {
          // Incremental: adicionar novos dados aos existentes
          const updatedFiles = [...csvFiles]
          updatedFiles[existingFileIndex].rows = [...updatedFiles[existingFileIndex].rows, ...newRows]
          updatedFiles[existingFileIndex].totalAmount += totalAmount
          updatedFiles[existingFileIndex].lastUpdated = formattedDate
          setCsvFiles(updatedFiles)
          
          // ✅ SALVAR AUTOMATICAMENTE NO SUPABASE
          await saveCSVFile(updatedFiles[existingFileIndex])
          
          // Atualizar timestamp
          const now = new Date()
          const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          setLastSaved(formattedTime)
        } else {
          // Adicionar novo arquivo
          const updatedFiles = [...csvFiles, newFile]
          setCsvFiles(updatedFiles)
          
          // ✅ SALVAR AUTOMATICAMENTE NO SUPABASE
          await saveCSVFile(newFile)
          
          // Atualizar timestamp
          const now = new Date()
          const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          setLastSaved(formattedTime)
        }
      }
      
      reader.readAsText(file)
    }
  }

  const startEditing = (rowId: string, currentCategory: string, currentClassification: string, currentDepositAccount?: string, currentPaymentMethod?: string, currentOrderNumbers?: string[]) => {
    setEditingRow(rowId)
    setEditedCategory(currentCategory)
    setEditedClassification(currentClassification)
    setEditedDepositAccount(currentDepositAccount || "")
    setEditedPaymentMethod(currentPaymentMethod || "")
    setEditedOrderNumbers(currentOrderNumbers || [])
    setNewOrderInput("")
  }

  const addOrderNumber = () => {
    if (newOrderInput.trim()) {
      setEditedOrderNumbers([...editedOrderNumbers, newOrderInput.trim()])
      setNewOrderInput("")
    }
  }

  const removeOrderNumber = (index: number) => {
    setEditedOrderNumbers(editedOrderNumbers.filter((_, i) => i !== index))
  }

  const saveEdit = async (fileIndex: number, rowId: string) => {
    const updatedFiles = [...csvFiles]
    const rowIndex = updatedFiles[fileIndex].rows.findIndex(r => r.id === rowId)
    if (rowIndex !== -1) {
      updatedFiles[fileIndex].rows[rowIndex].category = editedCategory
      updatedFiles[fileIndex].rows[rowIndex].classification = editedClassification
      updatedFiles[fileIndex].rows[rowIndex].orderNumbers = editedOrderNumbers
      updatedFiles[fileIndex].rows[rowIndex].depositAccount = editedDepositAccount
      setCsvFiles(updatedFiles)
      
      // ✅ SALVAR AUTOMATICAMENTE NO SUPABASE
      await updateCSVRow(updatedFiles[fileIndex].rows[rowIndex])
      
      // Atualizar timestamp
      const now = new Date()
      const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setLastSaved(formattedTime)
    }
    setEditingRow(null)
    setEditedCategory("")
    setEditedClassification("")
    setEditedDepositAccount("")
    setEditedPaymentMethod("")
    setEditedOrderNumbers([])
    setNewOrderInput("")
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditedCategory("")
    setEditedClassification("")
    setEditedDepositAccount("")
    setEditedPaymentMethod("")
    setEditedOrderNumbers([])
    setNewOrderInput("")
  }

  // Função para deletar linha individual
  const handleDeleteRow = async (fileIndex: number, rowId: string) => {
    if (!confirm('Are you sure you want to delete this row?')) return

    const updatedFiles = [...csvFiles]
    const rowIndex = updatedFiles[fileIndex].rows.findIndex(r => r.id === rowId)
    
    if (rowIndex !== -1) {
      const deletedRow = updatedFiles[fileIndex].rows[rowIndex]
      updatedFiles[fileIndex].rows.splice(rowIndex, 1)
      updatedFiles[fileIndex].totalAmount -= deletedRow.amount
      setCsvFiles(updatedFiles)
      
      // ✅ DELETAR DO SUPABASE
      await deleteCSVRow(rowId)
      
      // Atualizar timestamp
      const now = new Date()
      const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setLastSaved(formattedTime)
    }
  }

  // Função para deletar todas as linhas de um arquivo
  const handleDeleteAllRows = async (fileIndex: number) => {
    if (!confirm('Are you sure you want to delete ALL rows from this file? This action cannot be undone!')) return

    const updatedFiles = [...csvFiles]
    const file = updatedFiles[fileIndex]
    
    // Deletar todas as linhas do Supabase
    for (const row of file.rows) {
      await deleteCSVRow(row.id)
    }
    
    // Remover arquivo da lista
    updatedFiles.splice(fileIndex, 1)
    setCsvFiles(updatedFiles)
    
    // Atualizar timestamp
    const now = new Date()
    const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    setLastSaved(formattedTime)
  }

  // NOVA FUNÇÃO: Deletar TODOS os dados de TODOS os reports
  const handleDeleteAllReports = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE ALL DATA from ALL reports! This action CANNOT be undone! Are you absolutely sure?')) return
    if (!confirm('⚠️ FINAL CONFIRMATION: All your financial data will be permanently deleted. Type YES to confirm.')) return

    setIsLoading(true)
    try {
      const result = await deleteAllReports()
      if (result.success) {
        setCsvFiles([])
        alert('✅ All reports have been successfully deleted. You can now start fresh.')
        // Recarregar dados (que estarão vazios)
        await loadData()
      } else {
        alert('❌ Error deleting reports. Please check your Supabase configuration.')
      }
    } catch (error) {
      console.error('Error deleting all reports:', error)
      alert('❌ Error deleting reports. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadFinalCSV = () => {
    if (csvFiles.length === 0) {
      alert('No data to export. Please upload CSV files first.')
      return
    }

    try {
      downloadFinalCSV(csvFiles)
    } catch (error) {
      console.error('Error downloading final CSV:', error)
      alert('Error downloading CSV file. Please try again.')
    }
  }

  const handleDownloadIndividualCSV = (file: CSVFile) => {
    if (!file || file.rows.length === 0) {
      alert('No data to download for this file.')
      return
    }

    try {
      downloadIndividualCSV(file)
    } catch (error) {
      console.error('Error downloading individual CSV:', error)
      alert('Error downloading CSV file. Please try again.')
    }
  }

  // Settings functions
  const addClassification = () => {
    if (newClassification && !classificationOptions.includes(newClassification)) {
      setClassificationOptions([...classificationOptions, newClassification])
      setNewClassification("")
    }
  }

  const removeClassification = (classification: string) => {
    setClassificationOptions(classificationOptions.filter(c => c !== classification))
  }

  const addPaymentMethod = () => {
    if (newPaymentMethod && !paymentMethodOptions.includes(newPaymentMethod)) {
      setPaymentMethodOptions([...paymentMethodOptions, newPaymentMethod])
      setNewPaymentMethod("")
    }
  }

  const removePaymentMethod = (method: string) => {
    setPaymentMethodOptions(paymentMethodOptions.filter(m => m !== method))
  }

  const addDepositAccount = () => {
    if (newDepositAccount && !depositAccountOptions.includes(newDepositAccount)) {
      setDepositAccountOptions([...depositAccountOptions, newDepositAccount])
      setNewDepositAccount("")
    }
  }

  const removeDepositAccount = (account: string) => {
    setDepositAccountOptions(depositAccountOptions.filter(a => a !== account))
  }

  const addCustomColumn = () => {
    if (newColumnName) {
      const newColumn: CustomColumn = {
        id: `custom_${Date.now()}`,
        name: newColumnName,
        type: newColumnType,
        options: newColumnType === 'select' ? newColumnOptions.split(',').map(o => o.trim()) : undefined
      }
      setCustomColumns([...customColumns, newColumn])
      setNewColumnName("")
      setNewColumnType('text')
      setNewColumnOptions("")
    }
  }

  const removeCustomColumn = (columnId: string) => {
    setCustomColumns(customColumns.filter(c => c.id !== columnId))
  }

  const getTotalRecords = () => {
    return csvFiles.reduce((sum, file) => sum + file.rows.length, 0)
  }

  const getTotalAmount = () => {
    return csvFiles.reduce((sum, file) => sum + file.totalAmount, 0)
  }

  const getRecentUpdate = () => {
    if (csvFiles.length === 0) return 'N/A'
    
    const dates = csvFiles.map(f => {
      const [day, month, year] = f.lastUpdated.split('/')
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    })
    
    const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())))
    const day = String(mostRecent.getDate()).padStart(2, '0')
    const month = String(mostRecent.getMonth() + 1).padStart(2, '0')
    const year = mostRecent.getFullYear()
    
    return `${day}/${month}/${year}`
  }

  const getFilesBySource = (source: CSVFile['source']) => {
    return csvFiles.filter(file => file.source === source)
  }

  const getSourceIcon = (source: string) => {
    if (source.includes('sabadell')) return <Building2 className="h-5 w-5" />
    if (source.includes('braintree')) return <CreditCard className="h-5 w-5" />
    if (source.includes('stripe')) return <Wallet className="h-5 w-5" />
    if (source.includes('gocardless')) return <CreditCard className="h-5 w-5" />
    if (source.includes('paypal')) return <Wallet className="h-5 w-5" />
    return <FileSpreadsheet className="h-5 w-5" />
  }

  // Função para calcular valores por período
  const getRevenueByPeriod = (source: CSVFile['source'], period: 'week' | 'lastWeek' | 'lastMonth' | 'year') => {
    const file = csvFiles.find(f => f.source === source)
    if (!file) return 0

    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    
    const startOfLastWeek = new Date(startOfWeek)
    startOfLastWeek.setDate(startOfWeek.getDate() - 7)
    
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
    
    const startOfYear = new Date(today.getFullYear(), 0, 1)

    return file.rows
      .filter(row => {
        const [day, month, year] = row.date.split('/')
        const rowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        
        switch(period) {
          case 'week':
            return rowDate >= startOfWeek && rowDate <= today
          case 'lastWeek':
            return rowDate >= startOfLastWeek && rowDate < startOfWeek
          case 'lastMonth':
            return rowDate >= startOfLastMonth && rowDate <= endOfLastMonth
          case 'year':
            return rowDate >= startOfYear && rowDate <= today
          default:
            return false
        }
      })
      .filter(row => row.amount > 0)
      .reduce((sum, row) => sum + row.amount, 0)
  }

  // Função para obter a data mais recente de cada fonte de pagamento
  const getPaymentSourceDates = () => {
    const dates: { [key: string]: string } = {}
    
    const sources: CSVFile['source'][] = ['sabadell', 'braintree-eur', 'braintree-usd', 'braintree-transactions', 'braintree-amex', 'braintree-amex-transactions', 'stripe', 'gocardless', 'paypal']
    
    sources.forEach(source => {
      const files = getFilesBySource(source)
      if (files.length > 0) {
        dates[source] = files[0].lastUpdated
      }
    })
    
    return dates
  }

  const renderSourceSection = (
    source: CSVFile['source'],
    title: string,
    description: string
  ) => {
    const files = getFilesBySource(source)
    
    return (
      <div id={source} className="scroll-mt-20">
        <Card className="shadow-xl border-[#e5e7eb] dark:border-[#2c3e5f] mb-8 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  {getSourceIcon(source)}
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">{title}</CardTitle>
                  <CardDescription className="text-white/80 mt-1">{description}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={(e) => handleFileUpload(e, source)}
                  className="hidden"
                  id={`file-upload-${source}`}
                />
                <label htmlFor={`file-upload-${source}`}>
                  <Button variant="secondary" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Upload CSV
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {/* Highlights de Data e Valores */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-[#4fc3f7]" />
                  <p className="text-xs text-white/70 font-medium">Last Update</p>
                </div>
                <p className="text-lg font-bold text-white">
                  {files.length > 0 ? files[0].lastUpdated : 'N/A'}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[#4fc3f7]" />
                  <p className="text-xs text-white/70 font-medium">This Week</p>
                </div>
                <p className="text-lg font-bold text-white">
                  €{getRevenueByPeriod(source, 'week').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-[#4fc3f7]" />
                  <p className="text-xs text-white/70 font-medium">Last Week</p>
                </div>
                <p className="text-lg font-bold text-white">
                  €{getRevenueByPeriod(source, 'lastWeek').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-[#4fc3f7]" />
                  <p className="text-xs text-white/70 font-medium">Last Month</p>
                </div>
                <p className="text-lg font-bold text-white">
                  €{getRevenueByPeriod(source, 'lastMonth').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-[#4fc3f7]" />
                  <p className="text-xs text-white/70 font-medium">Year to Date</p>
                </div>
                <p className="text-lg font-bold text-white">
                  €{getRevenueByPeriod(source, 'year').toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {files.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-[#e5e7eb] dark:border-[#2c3e5f] rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-slate-900 dark:to-slate-800">
                <FileSpreadsheet className="h-16 w-16 mx-auto text-[#1a2b4a] dark:text-[#4fc3f7] mb-4 opacity-50" />
                <p className="text-[#1a2b4a] dark:text-gray-300 mb-2 font-semibold text-lg">No files uploaded yet</p>
                <p className="text-sm text-gray-500">Upload a CSV file to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {files.length} file(s) uploaded. View detailed data in the dedicated report page.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a] dark:text-[#4fc3f7] mx-auto mb-4" />
          <p className="text-[#1a2b4a] dark:text-white font-semibold">Loading data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Sidebar currentPage="home" paymentSourceDates={getPaymentSourceDates()} />

      <div className="md:pl-64">
        <header className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-white dark:bg-[#1a2b4a] shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 md:ml-0 ml-12">
                <div>
                  <h1 className="text-2xl font-bold text-[#1a2b4a] dark:text-white">
                    Financial Reconciliation System
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Digital Smile Design Spain
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 border-[#1a2b4a] text-[#1a2b4a] hover:bg-[#1a2b4a] hover:text-white dark:border-[#4fc3f7] dark:text-[#4fc3f7]">
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-[#1a2b4a] dark:text-white">Data Management Settings</DialogTitle>
                      <DialogDescription>
                        Manage classifications, payment methods, deposit accounts, and custom columns
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Tabs defaultValue="classifications" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 bg-[#1a2b4a]/10">
                        <TabsTrigger value="classifications">Classifications</TabsTrigger>
                        <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
                        <TabsTrigger value="deposit-accounts">Deposit Accounts</TabsTrigger>
                        <TabsTrigger value="custom-columns">Custom Columns</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="classifications" className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Add New Classification</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter classification name"
                              value={newClassification}
                              onChange={(e) => setNewClassification(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addClassification()}
                              className="border-[#1a2b4a]"
                            />
                            <Button onClick={addClassification} className="bg-[#1a2b4a] hover:bg-[#2c3e5f]">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Current Classifications</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border-2 border-[#e5e7eb] dark:border-[#2c3e5f] rounded-lg">
                            {classificationOptions.map((classification) => (
                              <div key={classification} className="flex items-center justify-between p-3 bg-[#1a2b4a]/5 dark:bg-slate-800 rounded-lg border border-[#e5e7eb] dark:border-[#2c3e5f]">
                                <span className="text-sm font-medium text-[#1a2b4a] dark:text-white">{classification}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeClassification(classification)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="payment-methods" className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Add New Payment Method</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter payment method name"
                              value={newPaymentMethod}
                              onChange={(e) => setNewPaymentMethod(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addPaymentMethod()}
                              className="border-[#1a2b4a]"
                            />
                            <Button onClick={addPaymentMethod} className="bg-[#1a2b4a] hover:bg-[#2c3e5f]">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Current Payment Methods</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border-2 border-[#e5e7eb] dark:border-[#2c3e5f] rounded-lg">
                            {paymentMethodOptions.map((method) => (
                              <div key={method} className="flex items-center justify-between p-3 bg-[#1a2b4a]/5 dark:bg-slate-800 rounded-lg border border-[#e5e7eb] dark:border-[#2c3e5f]">
                                <span className="text-sm font-medium text-[#1a2b4a] dark:text-white">{method}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removePaymentMethod(method)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="deposit-accounts" className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Add New Deposit Account</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter deposit account name"
                              value={newDepositAccount}
                              onChange={(e) => setNewDepositAccount(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addDepositAccount()}
                              className="border-[#1a2b4a]"
                            />
                            <Button onClick={addDepositAccount} className="bg-[#1a2b4a] hover:bg-[#2c3e5f]">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Current Deposit Accounts</Label>
                          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto p-2 border-2 border-[#e5e7eb] dark:border-[#2c3e5f] rounded-lg">
                            {depositAccountOptions.map((account) => (
                              <div key={account} className="flex items-center justify-between p-3 bg-[#1a2b4a]/5 dark:bg-slate-800 rounded-lg border border-[#e5e7eb] dark:border-[#2c3e5f]">
                                <span className="text-sm font-medium text-[#1a2b4a] dark:text-white">{account}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeDepositAccount(account)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="custom-columns" className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-[#1a2b4a] dark:text-white font-semibold">Column Name</Label>
                            <Input
                              placeholder="Enter column name"
                              value={newColumnName}
                              onChange={(e) => setNewColumnName(e.target.value)}
                              className="border-[#1a2b4a]"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-[#1a2b4a] dark:text-white font-semibold">Column Type</Label>
                            <Select value={newColumnType} onValueChange={(value: 'text' | 'select' | 'number') => setNewColumnType(value)}>
                              <SelectTrigger className="border-[#1a2b4a]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="select">Select (Dropdown)</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {newColumnType === 'select' && (
                            <div className="space-y-2">
                              <Label className="text-[#1a2b4a] dark:text-white font-semibold">Options (comma-separated)</Label>
                              <Input
                                placeholder="Option 1, Option 2, Option 3"
                                value={newColumnOptions}
                                onChange={(e) => setNewColumnOptions(e.target.value)}
                                className="border-[#1a2b4a]"
                              />
                            </div>
                          )}
                          
                          <Button onClick={addCustomColumn} className="w-full bg-[#1a2b4a] hover:bg-[#2c3e5f]">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Custom Column
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-[#1a2b4a] dark:text-white font-semibold">Current Custom Columns</Label>
                          <div className="space-y-2 max-h-[200px] overflow-y-auto p-2 border-2 border-[#e5e7eb] dark:border-[#2c3e5f] rounded-lg">
                            {customColumns.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">No custom columns yet</p>
                            ) : (
                              customColumns.map((column) => (
                                <div key={column.id} className="flex items-center justify-between p-3 bg-[#1a2b4a]/5 dark:bg-slate-800 rounded-lg border border-[#e5e7eb] dark:border-[#2c3e5f]">
                                  <div>
                                    <p className="text-sm font-bold text-[#1a2b4a] dark:text-white">{column.name}</p>
                                    <p className="text-xs text-gray-500">
                                      Type: {column.type}
                                      {column.options && ` (${column.options.length} options)`}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeCustomColumn(column.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>

                {/* BOTÃO DE SALVAR MANUAL */}
                <Button 
                  onClick={saveAllData}
                  disabled={isSaving || csvFiles.length === 0}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      <span className="hidden sm:inline">Save All Changes</span>
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={handleDownloadFinalCSV}
                  className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] hover:from-[#2c3e5f] hover:to-[#1a2b4a] gap-2 shadow-lg"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export All</span>
                </Button>
                
                <Button 
                  onClick={handleDeleteAllReports}
                  variant="destructive"
                  className="gap-2 shadow-lg"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete All Reports</span>
                </Button>
              </div>
            </div>

            {/* FEEDBACK DE SALVAMENTO */}
            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
                  ✅ All changes saved successfully to database! Last saved: {lastSaved}
                </AlertDescription>
              </Alert>
            )}

            {/* INDICADOR DE ÚLTIMO SALVAMENTO */}
            {lastSaved && !saveSuccess && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Last saved: {lastSaved}</span>
              </div>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2">
                  Total Sources
                </CardTitle>
                <div className="text-4xl font-bold text-white">
                  9
                </div>
                <p className="text-xs text-white/70 mt-2">Payment sources</p>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2">
                  Total Records
                </CardTitle>
                <div className="text-4xl font-bold text-white">
                  {getTotalRecords()}
                </div>
                <p className="text-xs text-white/70 mt-2">Transactions</p>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#4fc3f7] to-[#00bcd4] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2">
                  Total Amount
                </CardTitle>
                <div className="text-4xl font-bold text-white">
                  €{getTotalAmount().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-white/70 mt-2">Combined value</p>
              </div>
            </Card>

            <Card className="shadow-xl border-2 border-[#e5e7eb] dark:border-[#2c3e5f] overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] p-6">
                <CardTitle className="text-sm font-bold text-white/80 mb-2">
                  Last Updated
                </CardTitle>
                <div className="text-3xl font-bold text-white">
                  {getRecentUpdate()}
                </div>
                <p className="text-xs text-white/70 mt-2">Most recent</p>
              </div>
            </Card>
          </div>

          {/* Reconciliation Alert */}
          <Alert className="mb-8 border-2 border-[#4fc3f7] bg-[#4fc3f7]/10 shadow-lg" id="reconciliation">
            <ArrowRightLeft className="h-5 w-5 text-[#1a2b4a] dark:text-[#4fc3f7]" />
            <AlertDescription className="text-[#1a2b4a] dark:text-white font-medium">
              <strong>Reconciliation Status:</strong> Upload CSV files from each payment source to begin the reconciliation process. The system will automatically match transactions between sources.
            </AlertDescription>
          </Alert>

          {/* Bank Statements Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1a2b4a] dark:text-white mb-4 flex items-center gap-3">
              <Building2 className="h-7 w-7" />
              Bank Statements
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Bank account statements and transactions - view detailed data in dedicated report pages</p>
            <Alert className="border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200 font-medium">
                Bank statement data is managed in dedicated pages. Access <strong>Bankinter EUR</strong> and <strong>Bankinter USD</strong> from the sidebar menu under the Bank Statements section.
              </AlertDescription>
            </Alert>
          </div>

          {/* Payment Sources Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1a2b4a] dark:text-white mb-4 flex items-center gap-3">
              <CreditCard className="h-7 w-7" />
              Payment Sources
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Payment gateways and processors</p>
            
            {/* Braintree Section */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-[#1a2b4a] dark:text-white mb-4 ml-4">Braintree</h3>
              {renderSourceSection('braintree-eur', 'Braintree EUR', 'EUR transactions')}
              {renderSourceSection('braintree-usd', 'Braintree USD', 'USD transactions')}
              {renderSourceSection('braintree-transactions', 'Braintree Transactions', 'All transactions')}
              {renderSourceSection('braintree-amex', 'Braintree Amex', 'Amex transactions')}
              {renderSourceSection('braintree-amex-transactions', 'Braintree Amex Transactions', 'Amex all transactions')}
            </div>

            {renderSourceSection('stripe', 'Stripe', 'Payment processing and invoices')}
            {renderSourceSection('gocardless', 'GoCardless', 'Direct debit payments')}
            {renderSourceSection('paypal', 'PayPal', 'PayPal transactions')}
          </div>

          {/* Export Section */}
          <Card className="shadow-xl mt-8 bg-gradient-to-br from-[#4fc3f7]/10 to-[#00bcd4]/10 border-2 border-[#4fc3f7]" id="export">
            <CardHeader>
              <CardTitle className="text-2xl text-[#1a2b4a] dark:text-white flex items-center gap-3 font-bold">
                <CheckCircle className="h-7 w-7 text-[#4fc3f7]" />
                Ready to Export
              </CardTitle>
              <CardDescription className="text-[#1a2b4a] dark:text-gray-300 font-medium">
                All data has been processed and is ready for export. Download the consolidated CSV file with all reconciled transactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-bold text-[#1a2b4a] dark:text-white">
                    Total Records: {getTotalRecords()}
                  </p>
                  <p className="text-sm font-bold text-[#1a2b4a] dark:text-white">
                    Total Amount: €{getTotalAmount().toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm font-bold text-[#1a2b4a] dark:text-white">
                    Sources: All payment sources and bank statements
                  </p>
                </div>
                <Button 
                  onClick={handleDownloadFinalCSV}
                  size="lg"
                  className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] hover:from-[#2c3e5f] hover:to-[#1a2b4a] gap-2 w-full sm:w-auto shadow-xl"
                >
                  <Download className="h-5 w-5" />
                  Download Reconciled Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
