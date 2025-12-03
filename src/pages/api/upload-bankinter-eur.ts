import { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import crypto from "crypto"

const CRLF = "\r\n"

// Inicializa Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function extractFileBuffer(req: NextApiRequest) {
  const contentType = req.headers["content-type"] || ""

  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type inválido. Envie um FormData com o arquivo XLSX.")
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/)
  if (!boundaryMatch) {
    throw new Error("Boundary do multipart não encontrado.")
  }

  const boundary = boundaryMatch[1]
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)

  const headerDelimiter = Buffer.from(`${CRLF}${CRLF}`)
  const headerEndIndex = buffer.indexOf(headerDelimiter)

  if (headerEndIndex === -1) {
    throw new Error("Cabeçalhos do multipart não encontrados.")
  }

  const boundaryDelimiter = Buffer.from(`${CRLF}--${boundary}`)
  const fileStart = headerEndIndex + headerDelimiter.length
  const fileEnd = buffer.indexOf(boundaryDelimiter, fileStart)

  if (fileEnd === -1) {
    throw new Error("Delimitador do multipart não encontrado no corpo da requisição.")
  }

  return buffer.slice(fileStart, fileEnd)
}

function parseAmount(value: any) {
  if (value === undefined || value === null) return 0

  const raw = String(value).replace(/\s+/g, "")

  if (raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(/,/g, ".")
    const parsed = parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeBankinterDate(fecha: any) {
  if (typeof fecha === "number") {
    const parsed = XLSX.SSF.parse_date_code(fecha)

    if (!parsed) {
      throw new Error("Não foi possível interpretar a data numérica do XLSX.")
    }

    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    return date.toISOString().split("T")[0]
  }

  if (typeof fecha === "string") {
    const trimmed = fecha.trim()
    const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)

    if (match) {
      const day = Number(match[1])
      const month = Number(match[2])
      const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])
      const parsedDate = new Date(Date.UTC(year, month - 1, day))
      return parsedDate.toISOString().split("T")[0]
    }

    const parsed = new Date(trimmed)

    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0]
    }
  }

  throw new Error("Formato de data não reconhecido no arquivo.")
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" })
    }

    const buffer = await extractFileBuffer(req)

    // Lê o arquivo XLSX
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Ignora as 5 primeiras linhas
    const filteredData = data.slice(5).filter((row: any[]) => row.length > 1)

    // Remove rodapé
    const endIndex = filteredData.findIndex(
      (r: any[]) => r[0]?.toString().toUpperCase().includes("INFORMACIÓN DE INTERÉS"),
    )
    const cleanData = endIndex !== -1 ? filteredData.slice(0, endIndex) : filteredData

    // Identifica cabeçalhos
    const headers = cleanData[0]
    const rows = cleanData.slice(1)

    const fechaValorIndex = headers.findIndex((h: string) => h.toUpperCase().includes("FECHA VALOR"))
    const descripcionIndex = headers.findIndex((h: string) => h.toUpperCase().includes("DESCRIPCIÓN"))
    const haberIndex = headers.findIndex((h: string) => h.toUpperCase() === "HABER")
    const debeIndex = headers.findIndex((h: string) => h.toUpperCase() === "DEBE")

    if (fechaValorIndex === -1 || descripcionIndex === -1) {
      throw new Error("❌ Cabeçalhos obrigatórios não encontrados no arquivo.")
    }

    // Mapeia as linhas
    const parsedRows = rows
      .map((r: any[]) => {
        const fecha = r[fechaValorIndex]
        const descripcion = r[descripcionIndex]
        const haber = parseAmount(r[haberIndex])
        const debe = parseAmount(r[debeIndex])
        const amount = haber - debe

        if (!fecha || (!haber && !debe)) return null

        return {
          id: crypto.randomUUID(),
          file_name: "bankinter-eur.xlsx",
          source: "bankinter-eur",
          date: normalizeBankinterDate(fecha),
          description: descripcion || "",
          amount: amount,
          category: "Other",
          classification: "Other",
          reconciled: false,
          custom_data: {
            raw: r,
            conciliado: false,
            paymentSource: null,
            reconciliationType: null,
          },
        }
      })
      .filter(Boolean)

    if (!parsedRows.length) {
      throw new Error("Nenhuma linha válida encontrada no arquivo XLSX.")
    }

    const { error } = await supabase.from("csv_rows").insert(parsedRows)
    if (error) throw error

    console.log(`✅ ${parsedRows.length} linhas inseridas no Supabase com sucesso.`)
    res.status(200).json({ success: true, inserted: parsedRows.length })
  } catch (error: any) {
    console.error("❌ Erro ao processar upload:", error.message)
    res.status(500).json({ success: false, error: error.message })
  }
}
