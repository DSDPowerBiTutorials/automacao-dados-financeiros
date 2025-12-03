"use client"

import { useEffect, useMemo, useState } from "react"
import { format } from "date-fns"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sidebar } from "@/components/custom/sidebar"
import { useToast } from "@/hooks/use-toast"

interface CsvFileRow {
  source: string
  created_at: string | null
  url: string | null
}

interface SourceItem {
  source: string
  label: string
}

const sources: SourceItem[] = [
  { source: "bankinter-eur", label: "Bankinter EUR" },
  { source: "bankinter-usd", label: "Bankinter USD" },
  { source: "sabadell-eur", label: "Sabadell EUR" },
]

export default function ReconciliationCenter() {
  const [rows, setRows] = useState<CsvFileRow[]>([])
  const [links, setLinks] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  const { toast } = useToast()

  useEffect(() => {
    const loadRows = async () => {
      setIsLoading(true)
      try {
        if (!supabase) {
          throw new Error("Supabase client is not configured.")
        }

        const { data, error } = await supabase
          .from("csv_files")
          .select("source, created_at, url")
          .order("created_at", { ascending: false })

        if (error) {
          throw error
        }

        const sanitizedData = data ?? []
        setRows(sanitizedData)

        const initialLinks: Record<string, string> = {}
        sanitizedData.forEach((item) => {
          if (item.url) {
            initialLinks[item.source] = item.url
          }
        })
        setLinks(initialLinks)
      } catch (error) {
        console.error("❌ Erro ao carregar CSVs do Supabase:", error)
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os uploads recentes. Tente novamente em instantes.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    void loadRows()
  }, [toast])

  const handleSave = async (src: string) => {
    const link = links[src]
    if (!link) {
      toast({
        title: "Informe um link",
        description: "Adicione uma URL válida antes de salvar.",
        variant: "destructive",
      })
      return
    }

    setIsSaving((prev) => ({ ...prev, [src]: true }))

    try {
      if (!supabase) {
        throw new Error("Supabase client is not configured.")
      }

      const { error } = await supabase.from("csv_files").update({ url: link }).eq("source", src)

      if (error) {
        throw error
      }

      toast({
        title: "Link atualizado",
        description: "URL salva com sucesso no Supabase.",
      })
    } catch (error) {
      console.error("❌ Erro ao salvar link no Supabase:", error)
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar o link. Verifique a URL e tente novamente.",
        variant: "destructive",
      })
    } finally {
      setIsSaving((prev) => ({ ...prev, [src]: false }))
    }
  }

  const now = useMemo(() => new Date(), [])

  const getStatus = (createdAt: string | null) => {
    if (!createdAt) {
      return {
        label: "Sem upload",
        color: "text-red-600",
      }
    }

    const lastUpload = new Date(createdAt)
    const days = Math.floor((now.getTime() - lastUpload.getTime()) / 86400000)

    if (days <= 2) {
      return { label: "Atualizado", color: "text-green-600" }
    }

    if (days <= 4) {
      return { label: "Pendente", color: "text-yellow-500" }
    }

    if (days <= 7) {
      return { label: "Atenção", color: "text-orange-500" }
    }

    return { label: "Desatualizado", color: "text-red-600" }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
      <Sidebar currentPage="reconciliation-center" />

      <main className="md:pl-64">
        <header className="border-b bg-white shadow-sm sticky top-0 z-20">
          <div className="container mx-auto px-6 py-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1a2b4a] to-[#2c3e5f] flex items-center justify-center">
              <FileSpreadsheet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1a2b4a]">Reconciliation Center</h1>
              <p className="text-sm text-gray-600">
                Monitoramento dos uploads CSV por conta e atualização de links de referência.
              </p>
            </div>
          </div>
        </header>

        <section className="container mx-auto px-6 py-10">
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-[#1a2b4a] to-[#2c3e5f] text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5" />
                <div>
                  <CardTitle className="text-xl">CSV Uploads</CardTitle>
                  <CardDescription className="text-white/80 text-sm">
                    Status e links das últimas importações.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-bold">Fonte</th>
                    <th className="text-left py-3 px-4 font-bold">Tipo de Integração</th>
                    <th className="text-center py-3 px-4 font-bold">Status</th>
                    <th className="text-center py-3 px-4 font-bold">Último Upload</th>
                    <th className="text-left py-3 px-4 font-bold">Link do CSV</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(({ source, label }) => {
                    const data = rows.find((row) => row.source === source)
                    const status = getStatus(data?.created_at ?? null)

                    return (
                      <tr key={source} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-semibold text-gray-800">{label}</td>
                        <td className="py-3 px-4 text-gray-700">CSV Upload</td>
                        <td className={`py-3 px-4 text-center font-semibold ${status.color}`}>{status.label}</td>
                        <td className="py-3 px-4 text-center text-gray-700">
                          {data?.created_at ? format(new Date(data.created_at), "dd MMM yyyy") : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Input
                              value={links[source] ?? ""}
                              onChange={(event) => setLinks({ ...links, [source]: event.target.value })}
                              className="flex-1"
                              placeholder="https://..."
                            />
                            <Button onClick={() => void handleSave(source)} disabled={isSaving[source]}>
                              {isSaving[source] ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Salvar"
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}

                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-gray-600">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Carregando uploads...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-gray-600">
                        <div className="inline-flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span>Nenhum upload encontrado no Supabase.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
