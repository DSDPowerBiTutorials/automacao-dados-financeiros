'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import * as XLSX from "xlsx"

interface TransactionRow {
  id: string
  date: string
  description: string
  amount: number
  source: string
}

export default function BankinterEurPage() {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("source", "bankinter-eur")
        .order("date", { ascending: false })

      if (error) throw error
      setRows(data || [])
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet)
      const csv = XLSX.utils.sheet_to_csv(sheet)

      const fileName = `bankinter_eur_${Date.now()}.csv`
      const { error: uploadError } = await supabase.storage
        .from("csv_files")
        .upload(fileName, new Blob([csv], { type: "text/csv" }), { upsert: true })
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from("transactions").insert(
        rows.map((r: any) => ({
          id: crypto.randomUUID(),
          source: "bankinter-eur",
          date: r["Data"] || null,
          description: r["Descrição"] || "",
          amount: parseFloat(r["Valor"] || "0"),
        }))
      )
      if (insertError) throw insertError

      alert(`✅ Arquivo ${file.name} processado e salvo com sucesso!`)
      await loadData()
    } catch (err) {
      console.error("Erro ao processar upload:", err)
      alert("❌ Erro ao processar o arquivo. Verifique o formato e tente novamente.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Bankinter EUR - Upload de Arquivo</CardTitle>
          <CardDescription>
            Envie um arquivo XLSX ou CSV contendo as transações da conta Bankinter em euros.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="mb-4" />
          <Button onClick={loadData} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Recarregar Dados"}
          </Button>
          {isLoading ? (
            <p className="mt-4 text-gray-500">Carregando dados...</p>
          ) : (
            <table className="mt-6 w-full border">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="p-2 border">Data</th>
                  <th className="p-2 border">Descrição</th>
                  <th className="p-2 border">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400">
                      Nenhum dado encontrado
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-2 border">{r.date}</td>
                      <td className="p-2 border">{r.description}</td>
                      <td className="p-2 border text-right">{r.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
