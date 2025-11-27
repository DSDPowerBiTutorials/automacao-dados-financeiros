import { supabase } from './supabase'

export interface CSVRow {
  id: string
  date: string
  description: string
  amount: number
  category: string
  classification: string
  source: string
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
  source: 'bankinter-eur' | 'bankinter-usd' | 'sabadell' | 'braintree-eur' | 'braintree-usd' | 'braintree-transactions' | 'braintree-amex' | 'braintree-amex-transactions' | 'stripe' | 'gocardless' | 'paypal'
}

// Salvar arquivo CSV no banco
export async function saveCSVFile(file: CSVFile) {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Os dados não serão salvos.')
    return { success: false, error: 'Supabase não configurado' }
  }

  try {
    // Salvar informações do arquivo
    const { error: fileError } = await supabase
      .from('csv_files')
      .upsert({
        id: `${file.source}_${file.name}`,
        name: file.name,
        last_updated: file.lastUpdated,
        total_amount: file.totalAmount,
        source: file.source,
        updated_at: new Date().toISOString()
      })

    if (fileError) throw fileError

    // Salvar todas as linhas
    const rowsToInsert = file.rows.map(row => ({
      id: row.id,
      file_name: file.name,
      source: file.source,
      date: row.date,
      description: row.description,
      amount: row.amount,
      category: row.category,
      classification: row.classification,
      deposit_account: row.depositAccount,
      payment_method: row.paymentMethod,
      order_numbers: row.orderNumbers || [],
      reconciled: row.reconciled || false,
      matched_with: row.matchedWith,
      custom_data: row,
      updated_at: new Date().toISOString()
    }))

    const { error: rowsError } = await supabase
      .from('csv_rows')
      .upsert(rowsToInsert)

    if (rowsError) throw rowsError

    return { success: true }
  } catch (error) {
    console.error('Error saving CSV file:', error)
    return { success: false, error }
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

// Atualizar uma linha específica
export async function updateCSVRow(row: CSVRow) {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Os dados não serão atualizados.')
    return { success: false, error: 'Supabase não configurado' }
  }

  try {
    const { error } = await supabase
      .from('csv_rows')
      .update({
        category: row.category,
        classification: row.classification,
        deposit_account: row.depositAccount,
        payment_method: row.paymentMethod,
        order_numbers: row.orderNumbers || [],
        reconciled: row.reconciled || false,
        matched_with: row.matchedWith,
        custom_data: row,
        updated_at: new Date().toISOString()
      })
      .eq('id', row.id)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error updating CSV row:', error)
    return { success: false, error }
  }
}

// Deletar uma linha específica
export async function deleteCSVRow(rowId: string) {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Os dados não serão deletados.')
    return { success: false, error: 'Supabase não configurado' }
  }

  try {
    const { error } = await supabase
      .from('csv_rows')
      .delete()
      .eq('id', rowId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error('Error deleting CSV row:', error)
    return { success: false, error }
  }
}

// Deletar arquivo e suas linhas
export async function deleteCSVFile(fileName: string, source: string) {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Os dados não serão deletados.')
    return { success: false, error: 'Supabase não configurado' }
  }

  try {
    // Deletar linhas
    const { error: rowsError } = await supabase
      .from('csv_rows')
      .delete()
      .eq('file_name', fileName)
      .eq('source', source)

    if (rowsError) throw rowsError

    // Deletar arquivo
    const { error: fileError } = await supabase
      .from('csv_files')
      .delete()
      .eq('name', fileName)
      .eq('source', source)

    if (fileError) throw fileError

    return { success: true }
  } catch (error) {
    console.error('Error deleting CSV file:', error)
    return { success: false, error }
  }
}

// NOVA FUNÇÃO: Deletar TODOS os dados de TODOS os reports
export async function deleteAllReports() {
  if (!supabase) {
    console.warn('⚠️ Supabase não configurado. Os dados não serão deletados.')
    return { success: false, error: 'Supabase não configurado' }
  }

  try {
    // Deletar TODAS as linhas
    const { error: rowsError } = await supabase
      .from('csv_rows')
      .delete()
      .neq('id', '') // Deleta tudo

    if (rowsError) throw rowsError

    // Deletar TODOS os arquivos
    const { error: filesError } = await supabase
      .from('csv_files')
      .delete()
      .neq('id', '') // Deleta tudo

    if (filesError) throw filesError

    return { success: true }
  } catch (error) {
    console.error('Error deleting all reports:', error)
    return { success: false, error }
  }
}
