"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Validar se as variáveis estão configuradas
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase não configurado. Configure as variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

// Cliente público (com RLS) - Configurado corretamente para autenticação persistente
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'sb-auth-token',
      flowType: 'pkce'
    },
  }
);

// Tipos para o banco de dados
export interface CSVRowDB {
  id: string;
  file_name: string;
  source: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  classification: string;
  deposit_account?: string;
  payment_method?: string;
  order_numbers?: string[];
  reconciled?: boolean;
  matched_with?: string;
  custom_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface CSVFileDB {
  id: string;
  name: string;
  last_updated: string;
  total_amount: number;
  source: string;
  created_at?: string;
  updated_at?: string;
}
