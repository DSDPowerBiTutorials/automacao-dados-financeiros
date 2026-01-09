import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

// Carregar .env.local
dotenv.config({ path: path.join(process.cwd(), ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Variáveis de ambiente faltando!")
    console.error("NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅" : "❌")
    console.error("SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "✅" : "❌")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function checkSchema() {
    console.log("🔍 Verificando schema da tabela csv_rows...\n")

    const { data, error } = await supabase.rpc("exec_sql", {
        sql: `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'csv_rows'
            ORDER BY ordinal_position;
        `
    })

    if (error) {
        // Tentar método alternativo
        console.log("Tentando método alternativo...\n")

        const { data: altData, error: altError } = await supabase
            .from("csv_rows")
            .select("*")
            .limit(0)

        if (altError) {
            console.error("❌ Erro:", altError)
            return
        }

        console.log("✅ Tabela existe, mas não consegui ver schema completo")
        console.log("Execute no SQL Editor do Supabase:")
        console.log(`
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'csv_rows'
ORDER BY ordinal_position;
        `)
        return
    }

    console.log("✅ Schema da tabela csv_rows:")
    console.table(data)

    // Verificar especificamente a coluna id
    const idColumn = data?.find((col: any) => col.column_name === "id")
    if (idColumn) {
        console.log("\n🎯 Coluna ID:")
        console.log(JSON.stringify(idColumn, null, 2))

        if (!idColumn.column_default) {
            console.log("\n⚠️  PROBLEMA ENCONTRADO!")
            console.log("A coluna 'id' não tem DEFAULT value configurado.")
            console.log("\nSolução - Execute no SQL Editor do Supabase:")
            console.log(`
-- Opção 1: Usar UUID com gen_random_uuid()
ALTER TABLE csv_rows 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- OU Opção 2: Usar SERIAL (se for integer)
-- Primeiro converter se necessário
ALTER TABLE csv_rows 
ALTER COLUMN id SET DEFAULT nextval('csv_rows_id_seq'::regclass);
            `)
        } else {
            console.log("\n✅ Coluna id tem DEFAULT configurado:", idColumn.column_default)
        }
    } else {
        console.log("\n❌ Coluna 'id' não encontrada!")
    }
}

checkSchema().catch(console.error)
