import { useEffect, useState } from "react"

export interface PapaParseConfig<T> {
  header?: boolean
  skipEmptyLines?: boolean | "greedy"
  worker?: boolean
  step?: (row: { data: T }) => void
  error?: (error: { message: string }) => void
  complete?: () => void
}

export interface PapaParseInstance {
  parse: <T>(file: File | string, config?: PapaParseConfig<T>) => void
}

declare global {
  interface Window {
    Papa?: PapaParseInstance
  }
}

export function usePapaParse() {
  const [papa, setPapa] = useState<PapaParseInstance | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    if (typeof window === "undefined") return

    if (window.Papa) {
      setPapa(window.Papa)
      return
    }

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"
    script.async = true

    script.onload = () => {
      if (!cancelled && window.Papa) {
        setPapa(window.Papa)
      }
    }

    script.onerror = event => {
      if (!cancelled) {
        const message = "Falha ao carregar PapaParse do CDN"
        console.error(`❌ ${message}`, event)
        setError(new Error(message))
      }
    }

    document.body.appendChild(script)

    return () => {
      cancelled = true
      script.remove()
    }
  }, [])

  return {
    papa,
    isReady: Boolean(papa),
    error
  }
}
