import { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import * as XLSX from "xlsx"
import crypto from "crypto"

// Inicializa Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    // Lê o corpo binário
    const chunks: Uint8Array[] = []
    for await (const chunk of req) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    // Lê o arquivo XLSX
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })

    // Ignora as 5 primeiras linhas
    const filteredData = data.slice(5).filter((row: any[]) => row.length > 1)

    // Remove rodapé
    const endIndex = filteredData.findIndex(
      (r: any[]) => r[0]?.toString().toUpperCase().includes("INFORMACIÓN DE INTERÉS")
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
        const haber = parseFloat(String(r[haberIndex] || "0").replace(",", ".")) || 0
        const debe = parseFloat(String(r[debeIndex] || "0").replace(",", ".")) || 0
        const amount = haber - debe

        if (!fecha || (!haber && !debe)) return null

        return {
          id: crypto.randomUUID(),
          file_name: "bankinter-eur.xlsx",
          source: "bankinter-eur",
          date: new Date(fecha).toISOString().split("T")[0],
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
