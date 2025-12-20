#!/usr/bin/env node

/**
 * Script para listar todas as tabelas do Supabase
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Credenciais do Supabase não encontradas no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  console.log("🔍 Buscando tabelas do Supabase...\n");

  try {
    // Query para listar todas as tabelas do schema público
    const { data, error } = await supabase.rpc("get_tables_list", {});

    if (error) {
      // Se a função RPC não existir, vamos usar outra abordagem
      console.log("⚠️  Função RPC não encontrada, verificando tabelas conhecidas...\n");
      
      const knownTables = [
        "csv_files",
        "csv_rows",
        "providers",
        "bank_accounts",
        "payment_methods",
        "cost_types",
        "dep_cost_types",
        "cost_centers",
        "invoices",
        "invoice_items",
        "customers",
        "customer_groups",
        "chart_of_accounts",
        "financial_accounts",
        "revenue_centers",
        "payment_terms",
        "tax_configurations",
        "approval_rules",
        "posting_profiles",
        "credit_policies",
        "dsd_courses"
      ];

      console.log("📊 Verificando tabelas conhecidas:\n");
      
      for (const table of knownTables) {
        try {
          const { data, error, count } = await supabase
            .from(table)
            .select("*", { count: "exact", head: true });

          if (!error) {
            console.log(`✅ ${table.padEnd(30)} - ${count || 0} registros`);
          } else {
            console.log(`❌ ${table.padEnd(30)} - Tabela não existe ou sem acesso`);
          }
        } catch (err) {
          console.log(`❌ ${table.padEnd(30)} - Erro: ${err.message}`);
        }
      }
    } else {
      console.log("✅ Tabelas encontradas:\n");
      data.forEach((table) => {
        console.log(`  📋 ${table.table_name}`);
      });
    }
  } catch (err) {
    console.error("❌ Erro ao listar tabelas:", err.message);
  }
}

listTables();
