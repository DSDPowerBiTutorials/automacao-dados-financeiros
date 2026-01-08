/**
 * Supabase Admin Client - SERVER-SIDE ONLY
 * Este arquivo NUNCA deve ser importado em componentes cliente ("use client")
 * Bypassa Row Level Security (RLS)
 */

import { createClient } from "@supabase/supabase-js";

// Validação rigorosa apenas no lado do servidor
if (typeof window === 'undefined') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file"
    );
  }
}

// Cria cliente admin apenas no servidor
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
