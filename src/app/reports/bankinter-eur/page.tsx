"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow } from "@/lib/database"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/custom/sidebar"
import Link from "next/link"

interface BankinterEURRow {
  id: string
  date: string // FECHA VALOR
  reference: string // REFERENCIA
  category: string // CATEGORÍA
  description: string // DESCRIPCIÓN
  amount: number // IMPORTE
  conciliado: boolean
  [key: string]: any
}

export default function BankinterEURPage() {
  const [rows, setRows] = useState<BankinterEURRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BankinterEURRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await loadAllCSVFiles()
      const bankinterFile = data.find(f => f.source === 'bankinter-eur')
      if (bankinterFile) {
        setRows(bankinterFile.rows as BankinterEURRow[])
      } else {
        setRows([])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split('\t').map(h => h.trim().replace(/^"|"$/g, ''))
        
        const newRows: BankinterEURRow[] = []
        let idCounter = rows.length + 1
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          const values = lines[i].split('\t').map(v => v.trim().replace(/^"|"$/g, ''))
          const row: any = {}
          
          headers.forEach((header, index) => {
            row[header] = values[index] || ''
          })
          
          // Mapear colunas do CSV para o formato simplificado
// Mapear colunas do CSV para o formato esperado
newRows.push({
  id: `BKEUR-${String(idCounter).padStart(4, '0')}`,

  // ===== Campos originais =====
  fecha_contable: row['FECHA CONTABLE'] || '',
  fecha_valor: row['FECHA VALOR'] || '',
  clave: row['CLAVE'] || '',
  referencia: row['REFERENCIA'] || '',
  categoria: row['CATEGORÍA'] || '',
  descripcion: row['DESCRIPCIÓN'] || '',
  ref_12: row['REF. 12'] || '',
  ref_16: row['REF. 16'] || '',
  debe: parseFloat(row['DEBE']?.replace(',', '.') || '0'),
  haber: parseFloat(row['HABER']?.replace(',', '.') || '0'),
  importe: parseFloat(row['IMPORTE']?.replace(',', '.') || '0'),
  saldo: parseFloat(row['SALDO']?.replace(',', '.') || '0'),

  // ===== Campos padrão que o resto do app usa =====
  date: row['FECHA VALOR'] || '',                      // Date
  reference: row['REFERENCIA'] || '',                  // Reference
  category: row['CATEGORÍA'] || '',                    // Category
  description: row['DESCRIPCIÓN'] || '',               // Description
  amount: parseFloat(row['IMPORTE']?.replace(',', '.') || '0'), // Amount

  conciliado: false,

  // Manter dados originais
  ...row
})

          idCounter++
        }
        
        const updatedRows = [...rows, ...newRows]
        setRows(updatedRows)
        
        // Salvar no Supabase
        const totalAmount = updatedRows.reduce((sum, row) => sum + row.amount, 0)
        const today = new Date()
        const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
        
        await saveCSVFile({
          name: file.name,
          lastUpdated: formattedDate,
          rows: updatedRows,
          totalAmount: totalAmount,
          source: 'bankinter-eur'
        })
        
        alert('✅ CSV uploaded successfully!')
      }
      
      reader.readAsText(file)
    }
  }

  const startEditing = (row: BankinterEURRow) => {
    setEditingRow(row.id)
    setEditedData({ ...row })
  }

  const saveEdit = async () => {
    if (!editingRow) return
    
    const updatedRows = rows.map(row => 
      row.id === editingRow ? { ...row, ...editedData } : row
    )
    setRows(updatedRows)
    
    const rowToUpdate = updatedRows.find(r => r.id === editingRow)
    if (rowToUpdate) {
      await updateCSVRow(rowToUpdate as any)
    }
    
    setEditingRow(null)
    setEditedData({})
  }

  const cancelEdit = () => {
    setEditingRow(null)
    setEditedData({})
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm('Are you sure you want to delete this row?')) return
    
    setIsDeleting(true)
    try {
      const result = await deleteCSVRow(rowId)
      if (result.success) {
        // Atualizar estado local removendo a linha deletada
        setRows(prevRows => prevRows.filter(r => r.id !== rowId))
        alert('✅ Row deleted successfully!')
      } else {
        alert('❌ Error deleting row. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting row:', error)
      alert('❌ Error deleting row. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE ALL rows from Bankinter EUR! Are you sure?')) return
    if (!confirm('⚠️ FINAL WARNING: This action CANNOT be undone! Continue?')) return
    
    setIsDeleting(true)
    try {
      // Deletar todas as linhas uma por uma
      const deletePromises = rows.map(row => deleteCSVRow(row.id))
      await Promise.all(deletePromises)
      
      // Limpar estado local
      setRows([])
      alert('✅ All rows deleted successfully!')
    } catch (error) {
      console.error('Error deleting all rows:', error)
      alert('❌ Error deleting rows. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadCSV = () => {
    const headers = ['ID', 'Date', 'Reference', 'Category', 'Description', 'Amount', 'Conciliado']
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => [
        row.id,
        row.date,
        row.reference,
        row.category,
        `"${row.description}"`,
        row.amount,
        row.conciliado ? 'Yes' : 'No'
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bankinter-eur-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <Sidebar currentPage="bankinter-eur" paymentSourceDates={{}} />

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
                    Bankinter EUR - Bank Statement
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload-bankinter"
                />
                <label htmlFor="file-upload-bankinter">
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
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Bank Statement Details</CardTitle>
              <CardDescription className="text-white/80">
                Simplified view with essential columns
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">ID</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Date</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Reference</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Category</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Description</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Amount</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Conciliado</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">
                          No data available. Upload a CSV file to get started.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className="border-b border-[#e5e7eb] dark:border-[#2c3e5f] hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-4 text-sm font-bold">{row.id}</td>
                          <td className="py-3 px-4 text-sm">
                            {editingRow === row.id ? (
                              <Input
                                value={editedData.date || ''}
                                onChange={(e) => setEditedData({ ...editedData, date: e.target.value })}
                                className="w-32"
                              />
                            ) : (
                              row.date
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {editingRow === row.id ? (
                              <Input
                                value={editedData.reference || ''}
                                onChange={(e) => setEditedData({ ...editedData, reference: e.target.value })}
                                className="w-32"
                              />
                            ) : (
                              row.reference
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {editingRow === row.id ? (
                              <Input
                                value={editedData.category || ''}
                                onChange={(e) => setEditedData({ ...editedData, category: e.target.value })}
                                className="w-32"
                              />
                            ) : (
                              row.category
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm max-w-xs truncate">
                            {editingRow === row.id ? (
                              <Input
                                value={editedData.description || ''}
                                onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                                className="w-full"
                              />
                            ) : (
                              row.description
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-right font-bold">
                            {editingRow === row.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedData.amount || 0}
                                onChange={(e) => setEditedData({ ...editedData, amount: parseFloat(e.target.value) })}
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
                                <Button size="sm" onClick={saveEdit} className="h-8 w-8 p-0">
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={cancelEdit} className="h-8 w-8 p-0">
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
  )
}
