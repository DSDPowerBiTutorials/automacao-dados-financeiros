"use client"

import { useEffect, useState } from "react"
import { Link2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { ButtonExport } from "@/components/ui/ButtonExport"
import { EditableSubtitle } from "@/components/ui/EditableSubtitle"
import { getSourceById, listenToSourceChanges, updateSourceURL } from "@/lib/sourceSync"

interface SourceUrlToolbarProps {
  sourceId: string
  subtitle?: string
  onSubtitleSave?: (value: string) => void
  onExport?: () => void
}

export function SourceUrlToolbar({ sourceId, subtitle, onSubtitleSave, onExport }: SourceUrlToolbarProps) {
  const [url, setUrl] = useState("")
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let isMounted = true

    const loadUrl = async () => {
      setIsLoading(true)
      try {
        const record = await getSourceById(sourceId)
        if (record && isMounted) {
          setUrl(record.url ?? "")
          setUpdatedAt(record.updated_at ?? null)
        }
      } catch (error) {
        console.error("❌ Erro ao carregar URL da fonte:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    const unsubscribe = listenToSourceChanges((record) => {
      if (record.source === sourceId && isMounted) {
        setUrl(record.url ?? "")
        setUpdatedAt(record.updated_at ?? null)
      }
    })

    void loadUrl()

    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [sourceId])

  const handleSave = async () => {
    if (!url) {
      toast({
        title: "Informe uma URL",
        description: "Adicione um endereço válido antes de salvar.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const result = await updateSourceURL(sourceId, url)
      if (result) {
        setUpdatedAt(result.updated_at ?? new Date().toISOString())
        toast({
          title: "URL sincronizada",
          description: "Link salvo no Supabase e propagado em tempo real.",
        })
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar", 
        description: "Não foi possível atualizar a URL no Supabase.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mb-6 border border-gray-200 shadow-sm">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-lg font-semibold text-[#1a2b4a]">Fonte: {sourceId}</CardTitle>
          {subtitle && <EditableSubtitle initialText={subtitle} onSave={onSubtitleSave} />}
        </div>
        <div className="text-xs text-gray-500">
          Última atualização: {updatedAt ? new Date(updatedAt).toLocaleString() : "—"}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-1 items-center gap-2">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder={isLoading ? "Carregando..." : "https://..."}
              disabled={isLoading}
            />
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="bg-[#1a2b4a] text-white hover:bg-[#152236]"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              Source URL
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <ButtonExport onClick={onExport ?? (() => undefined)} disabled={!onExport} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
