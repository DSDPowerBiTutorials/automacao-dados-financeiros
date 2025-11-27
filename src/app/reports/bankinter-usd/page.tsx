"use client"

import { useState, useEffect } from "react"
import { Upload, Download, Edit2, Save, X, Trash2, ArrowLeft, Loader2, CheckCircle, XCircle, Settings, Database } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/custom/sidebar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

interface BankinterUSDRow {
  id: string
  date: string
  description: string
  amount: number
  conciliado: boolean
  [key: string]: any
}

export default function BankinterUSDPage() {
  const [rows, setRows] = useState<BankinterUSDRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editedData, setEditedData] = useState<Partial<BankinterUSDRow>>({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      if (!supabase) {
        console.warn('Supabase not configured')
        setRows([])
        setIsLoading(false)
        return
      }

      const { data: rowsData, error } = await supabase
        .from('csv_rows')
        .select('*')
        .eq('source', 'bankinter-usd')
        .order('date', { ascending: false })

      if (error) {
        console.error('Error loading data:', error)
        setRows([])
      } else if (rowsData) {
        const mappedRows: BankinterUSDRow[] = rowsData.map(row => ({
          id: row.id,
          date: row.date,
          description: row.description || '',
          amount: parseFloat(row.amount) || 0,
          conciliado: row.custom_data?.conciliado || false
        }))
        setRows(mappedRows)
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
        
        console.log('=== BANKINTER USD CSV PROCESSING ===')
        console.log('Total lines:', lines.length)
        
        if (lines.length < 2) {
          alert('❌ File is empty or invalid')
          return
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        console.log('Headers found:', headers)
        
        const fechaValorIndex = headers.findIndex(h => 
          h.toUpperCase().replace(/[ÃÁ]/g, 'A').includes('FECHA') && 
          h.toUpperCase().includes('VALOR')
        )
        const descripcionIndex = headers.findIndex(h => 
          h.toUpperCase().replace(/[ÃÓÑ"]/g, 'O').includes('DESCRIPCI')
        )
        const haberIndex = headers.findIndex(h => 
          h.toUpperCase() === 'HABER'
        )
        
        console.log('Column mapping:')
        console.log('- FECHA VALOR index:', fechaValorIndex, '→', headers[fechaValorIndex])
        console.log('- DESCRIPCIÓN index:', descripcionIndex, '→', headers[descripcionIndex])
        console.log('- HABER index:', haberIndex, '→', headers[haberIndex])
        
        if (fechaValorIndex === -1 || descripcionIndex === -1 || haberIndex === -1) {
          alert('❌ Required columns not found! Make sure the file has: FECHA VALOR, DESCRIPCIÓN, HABER')
          console.error('Available columns:', headers)
          return
        }
        
        const newRows: BankinterUSDRow[] = []
        let processedCount = 0
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue
          
          const values: string[] = []
          let currentValue = ''
          let insideQuotes = false
          
          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j]
            
            if (char === '"') {
              insideQuotes = !insideQuotes
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim())
              currentValue = ''
            } else {
              currentValue += char
            }
          }
          values.push(currentValue.trim())
          
          const fechaValor = (values[fechaValorIndex] || '').trim()
          const descripcion = (values[descripcionIndex] || '').trim()
          const haberValue = (values[haberIndex] || '0').trim()
          
          let amountNumber = 0
          if (haberValue) {
            const cleanValue = haberValue
              .replace(/\s/g, '')
              .replace(',', '.')
            
            amountNumber = parseFloat(cleanValue) || 0
          }
          
          if (amountNumber === 0 && !descripcion) continue
          
          const uniqueId = `BANKINTER-USD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          
          newRows.push({
            id: uniqueId,
            date: fechaValor,
            description: descripcion,
            amount: amountNumber,
            conciliado: false
          })
          
          processedCount++
        }
        
        console.log('Processing complete:', processedCount, 'rows processed')
        
        if (newRows.length === 0) {
          alert('❌ No valid data found in file')
          return
        }
        
        try {
          setIsSaving(true)

          const rowsToInsert = newRows.map(row => ({
            id: row.id,
            file_name: 'bankinter-usd.csv',
            source: 'bankinter-usd',
            date: row.date,
            description: row.description,
            amount: row.amount.toString(),
            category: 'Other',
            classification: 'Other',
            reconciled: false,
            custom_data: {
              id: row.id,
              date: row.date,
              description: row.description,
              amount: row.amount,
              conciliado: row.conciliado
            }
          }))

          const response = await fetch('/api/csv-rows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: rowsToInsert, source: 'bankinter-usd' })
          })

          const result = await response.json()

          if (!response.ok || !result.success) {
            console.error('Error saving to database:', result.error)
            alert(`❌ Error saving to database: ${result.error || 'Unknown error'}`)
            return
          }

          const updatedRows = [...rows, ...newRows]
          setRows(updatedRows)

          const now = new Date()
          const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          setLastSaved(formattedTime)
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 3000)

          alert(`✅ File uploaded successfully! ${processedCount} rows saved to database.`)
        } catch (error) {
          console.error('Error saving to database:', error)
          alert('⚠️ Error saving to database. Please check your Supabase configuration.')
        } finally {
          setIsSaving(false)
        }
      }
      
      reader.readAsText(file)
    }
  }

  const saveAllChanges = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      const rowsToInsert = rows.map(row => ({
        id: row.id,
        file_name: 'bankinter-usd.csv',
        source: 'bankinter-usd',
        date: row.date,
        description: row.description,
        amount: row.amount.toString(),
        category: 'Other',
        classification: 'Other',
        reconciled: false,
        custom_data: {
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          conciliado: row.conciliado
        }
      }))

      const response = await fetch('/api/csv-rows', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rowsToInsert, source: 'bankinter-usd' })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('Error updating database:', result.error)
        alert(`❌ Error updating database: ${result.error || 'Unknown error'}`)
        return
      }

      const now = new Date()
      const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setLastSaved(formattedTime)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving data:', error)
      alert('Error saving data. Please check your Supabase configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = (row: BankinterUSDRow) => {
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
      try {
        const rowData = {
          id: rowToUpdate.id,
          file_name: 'bankinter-usd.csv',
          source: 'bankinter-usd',
          date: rowToUpdate.date,
          description: rowToUpdate.description,
          amount: rowToUpdate.amount.toString(),
          category: 'Other',
          classification: 'Other',
          reconciled: false,
          custom_data: {
            id: rowToUpdate.id,
            date: rowToUpdate.date,
            description: rowToUpdate.description,
            amount: rowToUpdate.amount,
            conciliado: rowToUpdate.conciliado
          }
        }

        const response = await fetch('/api/csv-rows', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: [rowData], source: 'bankinter-usd' })
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          console.error('Error updating row:', result.error)
          alert(`❌ Error updating row: ${result.error || 'Unknown error'}`)
        } else {
          const now = new Date()
          const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          setLastSaved(formattedTime)
        }
      } catch (error) {
        console.error('Error updating row:', error)
      }
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
      const response = await fetch(`/api/csv-rows?id=${rowId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('Error deleting row:', result.error)
        alert(`❌ Error deleting row: ${result.error || 'Unknown error'}`)
      } else {
        await loadData()
        
        const now = new Date()
        const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setLastSaved(formattedTime)
      }
    } catch (error) {
      console.error('Error deleting row:', error)
      alert('Error deleting row. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE ALL rows from Bankinter USD! Are you sure?')) return
    if (!confirm('⚠️ FINAL WARNING: This action CANNOT be undone! Continue?')) return
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/csv-rows?source=bankinter-usd`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('Error deleting all rows:', result.error)
        alert(`❌ Error deleting rows: ${result.error || 'Unknown error'}`)
      } else {
        await loadData()
        
        const now = new Date()
        const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        setLastSaved(formattedTime)
        
        alert('✅ All rows deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting all rows:', error)
      alert('Error deleting rows. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const downloadCSV = () => {
    try {
      const headers = ['ID', 'Date', 'Description', 'Amount', 'Conciliado']
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => [
          row.id,
          row.date,
          `"${row.description.replace(/"/g, '""')}"`,
          row.amount.toFixed(2),
          row.conciliado ? 'Yes' : 'No'
        ].join(','))
      ].join('\n')
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bankinter-usd-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error saving CSV file:', error)
      alert('Error downloading CSV file')
    }
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
      <Sidebar currentPage="bankinter-usd" paymentSourceDates={{}} />

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
                    Bankinter USD - Bank Statement
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {rows.length} records
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
                <Button 
                  onClick={saveAllChanges}
                  disabled={isSaving || rows.length === 0}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" />
                      Save All Changes
                    </>
                  )}
                </Button>
                <input
                  type="file"
                  accept=".csv"
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

            {saveSuccess && (
              <Alert className="mt-4 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-200 font-medium">
                  ✅ All changes saved successfully to database! Last saved: {lastSaved}
                </AlertDescription>
              </Alert>
            )}

            {lastSaved && !saveSuccess && (
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span>Last saved: {lastSaved}</span>
              </div>
            )}
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <Card className="shadow-xl">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <CardTitle>Bank Statement Details</CardTitle>
              <CardDescription className="text-white/80">
                Upload CSV files - Columns: FECHA VALOR → Date | DESCRIPCIÓN → Description | HABER → Amount
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-[#e5e7eb] dark:border-[#2c3e5f] bg-gray-50 dark:bg-slate-800">
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">ID</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Date</th>
                      <th className="text-left py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Description</th>
                      <th className="text-right py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Amount</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Conciliado</th>
                      <th className="text-center py-4 px-4 font-bold text-sm text-[#1a2b4a] dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500">
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
                          <td className="py-3 px-4 text-sm text-right font-bold text-[#4fc3f7]">
                            {editingRow === row.id ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={editedData.amount || 0}
                                onChange={(e) => setEditedData({ ...editedData, amount: parseFloat(e.target.value) })}
                                className="w-32"
                              />
                            ) : (
                              `$${row.amount.toFixed(2)}`
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
