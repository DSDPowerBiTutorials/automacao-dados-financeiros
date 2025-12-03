import { supabase } from "@/lib/supabase"

export interface SourceRecord {
  source: string
  url: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Callback = (data: SourceRecord) => void

const listeners = new Set<Callback>()
let subscription: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null

function ensureSubscription() {
  if (!supabase) {
    console.warn("⚠️ Supabase não está configurado; realtime desabilitado")
    return
  }

  if (subscription) return

  subscription = supabase
    .channel("csv_files_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "csv_files" },
      (payload) => {
        if (!payload.new) return
        listeners.forEach((listener) => {
          try {
            listener(payload.new as SourceRecord)
          } catch (error) {
            console.error("❌ Erro ao propagar atualização de fonte:", error)
          }
        })
      }
    )
    .subscribe((status) => {
      if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        subscription = null
      }
    })
}

export function listenToSourceChanges(callback: Callback) {
  listeners.add(callback)
  ensureSubscription()

  return () => {
    listeners.delete(callback)
    if (listeners.size === 0 && subscription && supabase) {
      void supabase.removeChannel(subscription)
      subscription = null
    }
  }
}

export async function updateSourceURL(source: string, url: string) {
  if (!supabase) {
    console.warn("⚠️ Supabase não está configurado; não é possível salvar a URL")
    return null
  }

  try {
    const { data, error } = await supabase.from("csv_files").upsert({ source, url }).select().single()

    if (error) {
      throw error
    }

    return data as SourceRecord
  } catch (error) {
    console.error("❌ Erro ao atualizar URL da fonte:", error)
    throw error
  }
}

export async function getAllSources() {
  if (!supabase) {
    console.warn("⚠️ Supabase não está configurado; retorno vazio para fontes")
    return [] as SourceRecord[]
  }

  try {
    const { data, error } = await supabase.from("csv_files").select("source, url, created_at, updated_at")
    if (error) {
      throw error
    }

    return (data ?? []) as SourceRecord[]
  } catch (error) {
    console.error("❌ Erro ao carregar fontes do Supabase:", error)
    return [] as SourceRecord[]
  }
}

export async function getSourceById(source: string) {
  if (!supabase) {
    console.warn("⚠️ Supabase não está configurado; retorno nulo para fonte", source)
    return null
  }

  try {
    const { data, error } = await supabase
      .from("csv_files")
      .select("source, url, created_at, updated_at")
      .eq("source", source)
      .maybeSingle()

    if (error) {
      throw error
    }

    return (data as SourceRecord) ?? null
  } catch (error) {
    console.error("❌ Erro ao buscar fonte:", error)
    return null
  }
}
