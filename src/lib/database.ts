import { supabase } from './supabase'

export interface CSVRow {
  id: string
  date: string
  description: string
  amount: number
  category?: string
  classification?: string
  source?: string
  depositAccount?: string
  paymentMethod?: string
  orderNumbers?: string[]
  reconciled?: boolean
  matchedWith?: string
  
  // Colunas específicas do Bankinter EUR
  fecha_contable?: string
  fecha_valor?: string
  clave?: string
  referencia?: string
  categoria?: string
  descripcion?: string
  ref_12?: string
  ref_16?: string
  debe?: number
  haber?: number
  importe?: number
  saldo?: number
  conciliado?: boolean
  
  // Colunas de conciliação Braintree EUR
  bank_conciliation?: boolean
  bank_name?: string
  
  // Colunas de conciliação Braintree Transactions
  braintree_eur_conciliation?: boolean
  customer_name?: string
  customer_email?: string
  order_id_1?: string
  order_id_2?: string
  order_id_3?: string
  order_id_4?: string
  
  [key: string]: any
}

export interface CSVFile {
  name: string
  lastUpdated: string
  rows: CSVRow[]
  totalAmount: number
  source: 'bankinter' | 'bankinter-eur' | 'bankinter-usd' | 'sabadell' | 'braintree-eur' | 'braintree-usd' | 'braintree-transactions' | 'braintree-amex' | 'braintree-amex-transactions' | 'stripe' | 'gocardless' | 'paypal'
}

// Salvar arquivo CSV no banco via API route
export async function saveCSVFile(file: CSVFile) {
  try {
    // Validar dados antes de enviar
    if (!file.name || !file.source || !file.rows || file.rows.length === 0) {
      throw new Error('Dados inválidos: arquivo deve ter nome, source e pelo menos uma linha')
    }

    const response = await fetch('/api/csv/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file }),
    })

    const result = await response.json()

    if (!result.success) {
      console.error('Error saving CSV file:', result.error)
      throw new Error(result.error)
    }

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error saving CSV file:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// Carregar todos os arquivos CSV do banco
export async function loadAllCSVFiles(): Promise<CSVFile[]> {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Retornando dados vazios.')
    return []
  }

  try {
    // Buscar todos os arquivos
    const { data: files, error: filesError } = await supabase
      .from('csv_files')
      .select('*')
      .order('updated_at', { ascending: false })

    if (filesError) throw filesError
    if (!files || files.length === 0) return []

    // Buscar todas as linhas
    const { data: rows, error: rowsError } = await supabase
      .from('csv_rows')
      .select('*')
      .order('date', { ascending: false })

    if (rowsError) throw rowsError
    if (!rows) return []

    // Agrupar linhas por arquivo
    const csvFiles: CSVFile[] = files.map(file => {
      const fileRows = rows
        .filter(row => row.file_name === file.name && row.source === file.source)
        .map(row => ({
          id: row.id,
          date: row.date,
          description: row.description,
          amount: row.amount,
          category: row.category,
          classification: row.classification,
          source: row.source,
          depositAccount: row.deposit_account,
          paymentMethod: row.payment_method,
          orderNumbers: row.order_numbers || [],
          reconciled: row.reconciled || false,
          matchedWith: row.matched_with,
          ...(row.custom_data || {})
        }))

      return {
        name: file.name,
        lastUpdated: file.last_updated,
        rows: fileRows,
        totalAmount: file.total_amount,
        source: file.source as CSVFile['source']
      }
    })

    return csvFiles
  } catch (error) {
    console.error('Error loading CSV files:', error)
    return []
  }
}

// Atualizar uma linha específica via API route
export async function updateCSVRow(row: CSVRow) {
  try {
    const response = await fetch('/api/csv/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ row }),
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating CSV row:', error)
    return { success: false, error }
  }
}

// Deletar uma linha específica via API route
export async function deleteCSVRow(rowId: string) {
  try {
    const response = await fetch(`/api/csv/delete?rowId=${rowId}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting CSV row:', error)
    return { success: false, error }
  }
}

// Deletar arquivo e suas linhas via API route
export async function deleteCSVFile(fileName: string, source: string) {
  try {
    const response = await fetch(`/api/csv/delete?fileName=${encodeURIComponent(fileName)}&source=${source}`, {
      method: 'DELETE',
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting CSV file:', error)
    return { success: false, error }
  }
}

// Deletar TODOS os dados de TODOS os reports via API route
export async function deleteAllReports() {
  try {
    const response = await fetch('/api/csv/delete?deleteAll=true', {
      method: 'DELETE',
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error)
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting all reports:', error)
    return { success: false, error }
  }
}
