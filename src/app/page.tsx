```tsx
"use client"

import { useState, useEffect } from "react"
import { Upload, FileSpreadsheet, Download, Edit2, Save, X, Calendar, CheckCircle, AlertCircle, Building2, CreditCard, Wallet, ArrowRightLeft, Settings, Plus, Trash2, TrendingUp, DollarSign, Loader2, Database } from "lucide-react"
import { loadAllCSVFiles, saveCSVFile, updateCSVRow, deleteCSVRow, deleteAllReports } from "@/lib/database"
import type { CSVFile, CSVRow } from "@/lib/database"
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

export default function Home() {
  const [csvFiles, setCsvFiles] = useState<CSVFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

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

  const saveAllData = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      for (const file of csvFiles) {
        await saveCSVFile(file)
      }
      const now = new Date()
      const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      setLastSaved(formattedTime)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving all data:', error)
      alert('Error saving data. Please check your Supabase configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAllReports = async () => {
    if (!confirm('⚠️ WARNING: This will DELETE ALL DATA from ALL reports! This action CANNOT be undone! Are you absolutely sure?')) return
    if (!confirm('⚠️ FINAL CONFIRMATION: All your financial data will be permanently deleted. Type YES to confirm.')) return

    setIsLoading(true)
    try {
      const result = await deleteAllReports()
      if (result.success) {
        setCsvFiles([])
        alert('✅ All reports have been successfully deleted. You can now start fresh.')
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

  const getTotalRecords = () => csvFiles.reduce((sum, file) => sum + file.rows.length, 0)
  const getTotalAmount = () => csvFiles.reduce((sum, file) => sum + file.totalAmount, 0)
  const getRecentUpdate = () => {
    if (csvFiles.length === 0) return 'N/A'
    const dates = csvFiles.map(f => {
      const [day, month, year] = f.lastUpdated.split('/')
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    })
    const mostRecent = new Date(Math.max(...dates.map(d => d.getTime())))
    return `${String(mostRecent.getDate()).padStart(2, '0')}/${String(mostRecent.getMonth() + 1).padStart(2, '0')}/${mostRecent.getFullYear()}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#1a2b4a]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar currentPage="home" paymentSourceDates={{}} />
      <div className="md:pl-64">
        <header className="border-b-2 border-gray-200 bg-white shadow-lg sticky top-0 z-30">
          <div className="container mx-auto px-6 py-5 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#1a2b4a]">Financial Reconciliation System</h1>
              <p className="text-sm text-gray-600">Digital Smile Design Spain</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={saveAllData} disabled={isSaving || csvFiles.length === 0} className="bg-emerald-600 text-white">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Save All
              </Button>
              <Button onClick={handleDeleteAllReports} variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete All Reports
              </Button>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card><CardContent><CardTitle>Total Sources</CardTitle><p className="text-2xl font-bold">9</p></CardContent></Card>
            <Card><CardContent><CardTitle>Total Records</CardTitle><p className="text-2xl font-bold">{getTotalRecords()}</p></CardContent></Card>
            <Card><CardContent><CardTitle>Total Amount</CardTitle><p className="text-2xl font-bold">€{getTotalAmount().toLocaleString('en-US')}</p></CardContent></Card>
            <Card><CardContent><CardTitle>Last Updated</CardTitle><p className="text-2xl font-bold">{getRecentUpdate()}</p></CardContent></Card>
          </div>

          <Alert className="mb-8 border-blue-500 bg-blue-50">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <AlertDescription className="text-blue-800 font-medium">
              Bank statement data is managed in dedicated pages. Access <strong>Bankinter EUR</strong> and <strong>Bankinter USD</strong> from the sidebar menu under "Bank Statements".
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}
```
