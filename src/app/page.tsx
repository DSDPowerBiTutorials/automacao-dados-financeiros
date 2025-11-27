"use client"

import { useState } from "react"
import { Upload, FileSpreadsheet, Download, Edit2, Save, X, Calendar, CheckCircle, AlertCircle, Building2, CreditCard, Wallet, ArrowRightLeft, Settings, Plus, Trash2, TrendingUp, DollarSign } from "lucide-react"
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
  source: 'bankinter-eur' | 'bankinter-usd' | 'sabadell' | 'braintree-eur' | 'braintree-usd' | 'braintree-transactions' | 'braintree-amex' | 'braintree-amex-transactions' | 'stripe' | 'gocardless' | 'paypal'
}

interface CustomColumn {
  id: string
  name: string
  type: 'text' | 'select' | 'number'
  options?: string[] // Para tipo select
}

export default function Home() {
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([
    {
      name: "Bankinter_EUR_Statement.csv",
      lastUpdated: "20/01/2024",
      totalAmount: 45230.50,
      source: 'bankinter-eur',
      rows: [
        { id: "BANK-001", date: "15/01/2024", description: "Wire Transfer - Client Payment", amount: 5600.00, category: "Revenue", classification: "Client Payment", source: "Bankinter EUR", paymentMethod: "Stripe", orderNumbers: ["ORD-2024-001", "ORD-2024-002"] },
        { id: "BANK-002", date: "16/01/2024", description: "Bank Fee - Monthly Maintenance", amount: -25.00, category: "Expense", classification: "Bank Fees", source: "Bankinter EUR", paymentMethod: "", orderNumbers: [] },
        { id: "BANK-003", date: "17/01/2024", description: "Direct Debit - Office Rent", amount: -2500.00, category: "Expense", classification: "Rent", source: "Bankinter EUR", paymentMethod: "", orderNumbers: [] },
        { id: "BANK-004", date: "18/01/2024", description: "Transfer In - Investment", amount: 15000.00, category: "Revenue", classification: "Investment", source: "Bankinter EUR", paymentMethod: "Braintree", orderNumbers: ["ORD-2024-003"] },
        { id: "BANK-005", date: "19/01/2024", description: "Card Payment - Supplies", amount: -345.50, category: "Expense", classification: "Supplies", source: "Bankinter EUR", paymentMethod: "", orderNumbers: [] },
      ]
    },
    {
      name: "Braintree_EUR_Transactions.csv",
      lastUpdated: "19/01/2024",
      totalAmount: 12450.00,
      source: 'braintree-eur',
      rows: [
        { id: "BT-EUR-001", date: "15/01/2024", description: "Payment Gateway - Order #1234", amount: 1250.00, category: "Revenue", classification: "Online Payment", source: "Braintree EUR", depositAccount: "Braintree", orderNumbers: ["ORD-2024-1234"] },
        { id: "BT-EUR-002", date: "16/01/2024", description: "Payment Gateway - Order #1235", amount: 890.00, category: "Revenue", classification: "Online Payment", source: "Braintree EUR", depositAccount: "Braintree", orderNumbers: ["ORD-2024-1235", "ORD-2024-1236"] },
        { id: "BT-EUR-003", date: "17/01/2024", description: "Transaction Fee", amount: -35.20, category: "Expense", classification: "Payment Fees", source: "Braintree EUR", depositAccount: "Braintree", orderNumbers: [] },
        { id: "BT-EUR-004", date: "18/01/2024", description: "Payment Gateway - Order #1236", amount: 2340.00, category: "Revenue", classification: "Online Payment", source: "Braintree EUR", depositAccount: "Braintree", orderNumbers: ["ORD-2024-1237"] },
        { id: "BT-EUR-005", date: "19/01/2024", description: "Refund - Order #1230", amount: -450.00, category: "Expense", classification: "Refund", source: "Braintree EUR", depositAccount: "Braintree", orderNumbers: ["ORD-2024-1230"] },
      ]
    },
    {
      name: "GoCardless_Payments.csv",
      lastUpdated: "18/01/2024",
      totalAmount: 8900.75,
      source: 'gocardless',
      rows: [
        { id: "GC-001", date: "15/01/2024", description: "Direct Debit - Subscription #456", amount: 299.00, category: "Revenue", classification: "Subscription", source: "GoCardless", depositAccount: "GoCardless", orderNumbers: ["ORD-2024-456"] },
        { id: "GC-002", date: "16/01/2024", description: "Direct Debit - Subscription #457", amount: 299.00, category: "Revenue", classification: "Subscription", source: "GoCardless", depositAccount: "GoCardless", orderNumbers: ["ORD-2024-457", "ORD-2024-458"] },
        { id: "GC-003", date: "17/01/2024", description: "Processing Fee", amount: -8.75, category: "Expense", classification: "Payment Fees", source: "GoCardless", depositAccount: "GoCardless", orderNumbers: [] },
        { id: "GC-004", date: "18/01/2024", description: "Direct Debit - Subscription #458", amount: 499.00, category: "Revenue", classification: "Subscription", source: "GoCardless", depositAccount: "GoCardless", orderNumbers: ["ORD-2024-459"] },
      ]
    },
    {
      name: "Stripe_Payments.csv",
      lastUpdated: "20/01/2024",
      totalAmount: 15670.30,
      source: 'stripe',
      rows: [
        { id: "ST-001", date: "15/01/2024", description: "Charge - Invoice #789", amount: 3400.50, category: "Revenue", classification: "Invoice Payment", source: "Stripe", depositAccount: "Stripe", orderNumbers: ["ORD-2024-789"] },
        { id: "ST-002", date: "16/01/2024", description: "Charge - Invoice #790", amount: 2100.00, category: "Revenue", classification: "Invoice Payment", source: "Stripe", depositAccount: "Stripe", orderNumbers: ["ORD-2024-790", "ORD-2024-791"] },
        { id: "ST-003", date: "17/01/2024", description: "Stripe Fee", amount: -98.20, category: "Expense", classification: "Payment Fees", source: "Stripe", depositAccount: "Stripe", orderNumbers: [] },
        { id: "ST-004", date: "18/01/2024", description: "Charge - Invoice #791", amount: 4500.00, category: "Revenue", classification: "Invoice Payment", source: "Stripe", depositAccount: "Stripe", orderNumbers: ["ORD-2024-792"] },
        { id: "ST-005", date: "19/01/2024", description: "Payout to Bank", amount: -5000.00, category: "Transfer", classification: "Bank Transfer", source: "Stripe", depositAccount: "Stripe", orderNumbers: [] },
        { id: "ST-006", date: "20/01/2024", description: "Charge - Invoice #792", amount: 1890.00, category: "Revenue", classification: "Invoice Payment", source: "Stripe", depositAccount: "Stripe", orderNumbers: ["ORD-2024-793", "ORD-2024-794", "ORD-2024-795"] },
      ]
    }
  ])

  const [editingRow, setEditingRow] = useState<string | null>(null)
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, source: CSVFile['source']) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split(',').map(h => h.trim().replace(/^\"|\"$/g, ''))
        
        const newRows: CSVRow[] = []
        
        // Gerar IDs sequenciais baseado no source
        const existingFile = csvFiles.find(f => f.source === source)
        let idCounter = existingFile ? existingFile.rows.length + 1 : 1
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          const values = lines[i].split(',').map(v => v.trim().replace(/^\"|\"$/g, ''))
          const row: any = {}
          
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          
          // Processar baseado na fonte
          if (source === 'stripe') {
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
        } else {
          // Adicionar novo arquivo
          setCsvFiles([...csvFiles, newFile])
        }
      }
      
      reader.readAsText(file)
    }
  }

  const startEditing = (rowId: string, currentClassification: string, currentDepositAccount?: string, currentPaymentMethod?: string, currentOrderNumbers?: string[]) => {
    setEditingRow(rowId)
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

  const saveEdit = (fileIndex: number, rowId: string) => {
    const updatedFiles = [...csvFiles]
    const rowIndex = updatedFiles[fileIndex].rows.findIndex(r => r.id === rowId)
    if (rowIndex !== -1) {
      updatedFiles[fileIndex].rows[rowIndex].classification = editedClassification
      updatedFiles[fileIndex].rows[rowIndex].orderNumbers = editedOrderNumbers
      if (updatedFiles[fileIndex].source !== 'bankinter-eur' && updatedFiles[fileIndex].source !== 'bankinter-usd' && updatedFiles[fileIndex].source !== 'sabadell') {
        updatedFiles[fileIndex].rows[rowIndex].depositAccount = editedDepositAccount
      } else {
        updatedFiles[fileIndex].rows[rowIndex].paymentMethod = editedPaymentMethod
      }
      setCsvFiles(updatedFiles)
    }
    setEditingRow(null)
    setEditedClassification("")
    setEditedDepositAccount("")
    setEditedPaymentMethod("")
    setEditedOrderNumbers([])
    setNewOrderInput("")
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditedClassification("")
    setEditedDepositAccount("")
    setEditedPaymentMethod("")
    setEditedOrderNumbers([])
    setNewOrderInput("")
  }

  const downloadFinalCSV = () => {
    let csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,PaymentMethod,OrderNumbers,Reconciled,MatchedWith\n"
    
    csvFiles.forEach(file => {
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        csvContent += `${row.id},${row.date},"${row.description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${row.paymentMethod || ''},${orderNumbersStr},${row.reconciled || false},${row.matchedWith || ''}\n`
      })
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `reconciled_data_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadIndividualCSV = (file: CSVFile) => {
    const isBankStatement = file.source === 'bankinter-eur' || file.source === 'bankinter-usd' || file.source === 'sabadell'
    
    // Para Stripe, incluir todas as colunas específicas
    if (file.source === 'stripe') {
      let csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers,automatic_payout_effective_at,net\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        csvContent += `${row.id},${row.date},"${row.description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.automatic_payout_effective_at},${row.net}\n`
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
    
    // Para GoCardless, incluir todas as colunas específicas
    if (file.source === 'gocardless') {
      let csvContent = "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers,payouts.arrival_date,net_amount\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        csvContent += `${row.id},${row.date},"${row.description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row['payouts.arrival_date']},${row.net_amount}\n`
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
    
    // Para Braintree EUR, incluir todas as colunas específicas
    if (file.source === 'braintree-eur') {
      let csvContent = "ID,Date,Description,Payout,Category,Classification,Source,DepositAccount,OrderNumbers,disbursement_date,settlement_currency_sales_EUR,discount_EUR,multicurrency_fees_EUR,per_transaction_fees_EUR,cross_border_fees_EUR,other_fees_EUR,chargebacks_lost_won_EUR,settlement_currency_refunds_EUR,#_of_refunds,chargeback_won_amt_EUR,#_of_chargebacks_won,chargeback_issued_amt_EUR,#_of_chargebacks_issued,chargeback_fees_EUR\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        csvContent += `${row.id},${row.date},"${row.description}",${row.payout || row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.disbursement_date},${row.settlement_currency_sales_EUR},${row.discount_EUR},${row.multicurrency_fees_EUR},${row.per_transaction_fees_EUR},${row.cross_border_fees_EUR},${row.other_fees_EUR},${row.chargebacks_lost_won_EUR},${row.settlement_currency_refunds_EUR},${row['#_of_refunds']},${row.chargeback_won_amt_EUR},${row['#_of_chargebacks_won']},${row.chargeback_issued_amt_EUR},${row['#_of_chargebacks_issued']},${row.chargeback_fees_EUR}\n`
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
    
    // Para Braintree USD, incluir todas as colunas específicas (suporta ambos os formatos)
    if (file.source === 'braintree-usd') {
      let csvContent = "ID,Date,Description,Payout,Category,Classification,Source,DepositAccount,OrderNumbers,disbursement_date,settlement_currency_sales,discount,multicurrency_fees,per_transaction_fees,cross_border_fees,other_fees,chargebacks_lost_won,settlement_currency_refunds,#_of_refunds,chargeback_won_amt,#_of_chargebacks_won,chargeback_issued_amt,#_of_chargebacks_issued,chargeback_fees\n"
      
      file.rows.forEach(row => {
        const orderNumbersStr = (row.orderNumbers || []).join(';')
        const settlementSales = row.settlement_currency_sales_EUR || row.settlement_currency_sales_USD || 0
        const discount = row.discount_EUR || row.discount_USD || 0
        const multicurrencyFees = row.multicurrency_fees_EUR || row.multicurrency_fees_USD || 0
        const perTransactionFees = row.per_transaction_fees_EUR || row.per_transaction_fees_USD || 0
        const crossBorderFees = row.cross_border_fees_EUR || row.cross_border_fees_USD || 0
        
        csvContent += `${row.id},${row.date},"${row.description}",${row.payout || row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr},${row.disbursement_date},${settlementSales},${discount},${multicurrencyFees},${perTransactionFees},${crossBorderFees},${row.other_fees_EUR || 0},${row.chargebacks_lost_won_EUR || 0},${row.settlement_currency_refunds_EUR || 0},${row['#_of_refunds'] || 0},${row.chargeback_won_amt_EUR || 0},${row['#_of_chargebacks_won'] || 0},${row.chargeback_issued_amt_EUR || 0},${row['#_of_chargebacks_issued'] || 0},${row.chargeback_fees_EUR || 0}\n`
      })

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      return
    }
    
    let csvContent = isBankStatement
      ? "ID,Date,Description,Amount,Category,Classification,Source,PaymentMethod,OrderNumbers\n"
      : "ID,Date,Description,Amount,Category,Classification,Source,DepositAccount,OrderNumbers\n"
    
    file.rows.forEach(row => {
      const orderNumbersStr = (row.orderNumbers || []).join(';')
      if (isBankStatement) {
        csvContent += `${row.id},${row.date},"${row.description}",${row.amount},${row.category},${row.classification},${row.source},${row.paymentMethod || ''},${orderNumbersStr}\n`
      } else {
        csvContent += `${row.id},${row.date},"${row.description}",${row.amount},${row.category},${row.classification},${row.source},${row.depositAccount || ''},${orderNumbersStr}\n`
      }
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${file.name.replace('.csv', '')}_reconciled.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
    if (source.includes('bankinter') || source.includes('sabadell')) return <Building2 className="h-5 w-5" />
    if (source.includes('braintree')) return <CreditCard className="h-5 w-5" />
    if (source.includes('stripe')) return <Wallet className="h-5 w-5" />
    if (source.includes('gocardless')) return <CreditCard className="h-5 w-5" />
    if (source.includes('paypal')) return <Wallet className="h-5 w-5" />
    return <FileSpreadsheet className="h-5 w-5" />
  }

  const getSourceColor = (source: string) => {
    return 'from-[#1a2b4a] to-[#2c3e5f]'
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
    
    const sources: CSVFile['source'][] = ['bankinter-eur', 'bankinter-usd', 'sabadell', 'braintree-eur', 'braintree-usd', 'braintree-transactions', 'braintree-amex', 'braintree-amex-transactions', 'stripe', 'gocardless', 'paypal']
    
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
    const isBankStatement = source === 'bankinter-eur' || source === 'bankinter-usd' || source === 'sabadell'
    
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
                {files.map((file, fileIndex) => {
                  const actualFileIndex = csvFiles.findIndex(f => f.name === file.name)
                  return (
                    <div key={fileIndex} className="border-2 border-[#e5e7eb] dark:border-[#2c3e5f] rounded-xl overflow-hidden shadow-lg">
                      <div className="bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-700 px-6 py-4 flex items-center justify-between border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f]">
                        <div className="flex items-center gap-4">
                          <FileSpreadsheet className="h-6 w-6 text-[#1a2b4a] dark:text-[#4fc3f7]" />
                          <div>
                            <p className="font-bold text-[#1a2b4a] dark:text-white text-lg">{file.name}</p>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {file.rows.length} records
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                Last updated: {file.lastUpdated}
                              </span>
                              <span className="text-sm font-bold text-[#4fc3f7]">
                                €{file.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button 
                          onClick={() => downloadIndividualCSV(file)}
                          className="gap-2 bg-[#1a2b4a] hover:bg-[#2c3e5f] text-white"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-700">
                              <th className="text-left py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">ID</th>
                              <th className="text-left py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Date</th>
                              <th className="text-left py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Description</th>
                              <th className="text-right py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">
                                {source === 'braintree-eur' || source === 'braintree-usd' ? 'Payout' : 'Amount'}
                              </th>
                              <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Category</th>
                              <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Classification</th>
                              {isBankStatement ? (
                                <>
                                  <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Payment Method</th>
                                  <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Order Numbers</th>
                                </>
                              ) : (
                                <>
                                  <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Deposit Account</th>
                                  <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Order Numbers</th>
                                </>
                              )}
                              <th className="text-center py-4 px-6 font-bold text-sm text-[#1a2b4a] dark:text-white">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {file.rows.map((row) => (
                              <tr key={row.id} className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-4 px-6 text-sm font-bold text-[#1a2b4a] dark:text-white">
                                  {row.id}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                                  {row.date}
                                </td>
                                <td className="py-4 px-6 text-sm text-gray-700 dark:text-gray-300">
                                  {row.description}
                                </td>
                                <td className={`py-4 px-6 text-sm text-right font-bold ${
                                  row.amount > 0 ? 'text-[#4fc3f7]' : 'text-red-600'
                                }`}>
                                  {row.amount > 0 ? '+' : ''}€{row.amount.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-center">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                    row.category === 'Revenue' 
                                      ? 'bg-[#4fc3f7]/20 text-[#1a2b4a] dark:text-[#4fc3f7]'
                                      : row.category === 'Expense'
                                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                  }`}>
                                    {row.category}
                                  </span>
                                </td>
                                <td className="py-4 px-6 text-center">
                                  {editingRow === row.id ? (
                                    <Select value={editedClassification} onValueChange={setEditedClassification}>
                                      <SelectTrigger className="w-[180px] mx-auto border-[#1a2b4a]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {classificationOptions.map((option) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1a2b4a]/10 text-[#1a2b4a] dark:bg-[#4fc3f7]/20 dark:text-[#4fc3f7]">
                                      {row.classification}
                                    </span>
                                  )}
                                </td>
                                {isBankStatement ? (
                                  <>
                                    <td className="py-4 px-6 text-center">
                                      {editingRow === row.id ? (
                                        <Select value={editedPaymentMethod} onValueChange={setEditedPaymentMethod}>
                                          <SelectTrigger className="w-[150px] mx-auto border-[#1a2b4a]">
                                            <SelectValue placeholder="Select method" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {paymentMethodOptions.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1a2b4a]/10 text-[#1a2b4a] dark:bg-[#4fc3f7]/20 dark:text-[#4fc3f7]">
                                          {row.paymentMethod || 'Not set'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      {editingRow === row.id ? (
                                        <div className="flex flex-col gap-2 items-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            {editedOrderNumbers.map((order, idx) => (
                                              <Badge key={idx} variant="secondary" className="gap-1">
                                                {order}
                                                <X 
                                                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                                                  onClick={() => removeOrderNumber(idx)}
                                                />
                                              </Badge>
                                            ))}
                                          </div>
                                          <div className="flex gap-1">
                                            <Input
                                              value={newOrderInput}
                                              onChange={(e) => setNewOrderInput(e.target.value)}
                                              onKeyPress={(e) => e.key === 'Enter' && addOrderNumber()}
                                              placeholder="ORD-XXXX"
                                              className="w-[120px] text-xs border-[#1a2b4a]"
                                            />
                                            <Button 
                                              size="sm" 
                                              onClick={addOrderNumber}
                                              className="h-8 w-8 p-0 bg-[#4fc3f7] hover:bg-[#00bcd4]"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 justify-center">
                                          {(row.orderNumbers && row.orderNumbers.length > 0) ? (
                                            row.orderNumbers.map((order, idx) => (
                                              <Badge key={idx} variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                                                {order}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-xs text-gray-400">No orders</span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-4 px-6 text-center">
                                      {editingRow === row.id ? (
                                        <Select value={editedDepositAccount} onValueChange={setEditedDepositAccount}>
                                          <SelectTrigger className="w-[150px] mx-auto border-[#1a2b4a]">
                                            <SelectValue placeholder="Select account" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {depositAccountOptions.map((option) => (
                                              <SelectItem key={option} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1a2b4a]/10 text-[#1a2b4a] dark:bg-[#4fc3f7]/20 dark:text-[#4fc3f7]">
                                          {row.depositAccount || 'Not set'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                      {editingRow === row.id ? (
                                        <div className="flex flex-col gap-2 items-center">
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            {editedOrderNumbers.map((order, idx) => (
                                              <Badge key={idx} variant="secondary" className="gap-1">
                                                {order}
                                                <X 
                                                  className="h-3 w-3 cursor-pointer hover:text-red-600" 
                                                  onClick={() => removeOrderNumber(idx)}
                                                />
                                              </Badge>
                                            ))}
                                          </div>
                                          <div className="flex gap-1">
                                            <Input
                                              value={newOrderInput}
                                              onChange={(e) => setNewOrderInput(e.target.value)}
                                              onKeyPress={(e) => e.key === 'Enter' && addOrderNumber()}
                                              placeholder="ORD-XXXX"
                                              className="w-[120px] text-xs border-[#1a2b4a]"
                                            />
                                            <Button 
                                              size="sm" 
                                              onClick={addOrderNumber}
                                              className="h-8 w-8 p-0 bg-[#4fc3f7] hover:bg-[#00bcd4]"
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 justify-center">
                                          {(row.orderNumbers && row.orderNumbers.length > 0) ? (
                                            row.orderNumbers.map((order, idx) => (
                                              <Badge key={idx} variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                                                {order}
                                              </Badge>
                                            ))
                                          ) : (
                                            <span className="text-xs text-gray-400">No orders</span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </>
                                )}
                                <td className="py-4 px-6 text-center">
                                  {editingRow === row.id ? (
                                    <div className="flex items-center justify-center gap-2">
                                      <Button 
                                        size="sm" 
                                        onClick={() => saveEdit(actualFileIndex, row.id)}
                                        className="h-9 w-9 p-0 bg-[#4fc3f7] hover:bg-[#00bcd4] text-white"
                                      >
                                        <Save className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={cancelEdit}
                                        className="h-9 w-9 p-0 border-[#1a2b4a]"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button 
                                      size="sm" 
                                      variant="ghost"
                                      onClick={() => startEditing(row.id, row.classification, row.depositAccount, row.paymentMethod, row.orderNumbers)}
                                      className="h-9 w-9 p-0 hover:bg-[#1a2b4a]/10"
                                    >
                                      <Edit2 className="h-4 w-4 text-[#1a2b4a] dark:text-[#4fc3f7]" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
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
                
                <Button 
                  onClick={downloadFinalCSV}
                  className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] hover:from-[#2c3e5f] hover:to-[#1a2b4a] gap-2 shadow-lg"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export All</span>
                </Button>
              </div>
            </div>
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
                  11
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Bank account statements and transactions</p>
            {renderSourceSection('bankinter-eur', 'Bankinter EUR', 'EUR bank account')}
            {renderSourceSection('bankinter-usd', 'Bankinter USD', 'USD bank account')}
            {renderSourceSection('sabadell', 'Sabadell', 'Bank account')}
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
                  onClick={downloadFinalCSV}
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
