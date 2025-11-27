import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Validar se as variáveis estão configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase não configurado. Configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Cliente público (com RLS)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Cliente admin (bypassa RLS) - usar apenas em operações server-side
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Tipos para o banco de dados
export interface CSVRowDB {
  id: string
  file_name: string
  source: string
  date: string
  description: string
  amount: number
  category: string
  classification: string
  deposit_account?: string
  payment_method?: string
  order_numbers?: string[]
  reconciled?: boolean
  matched_with?: string
  custom_data?: any
  created_at?: string
  updated_at?: string
}

export interface CSVFileDB {
  id: string
  name: string
  last_updated: string
  total_amount: number
  source: string
  created_at?: string
  updated_at?: string
}
