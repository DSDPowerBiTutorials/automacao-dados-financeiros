#!/usr/bin/env node
/**
 * Apply migration via Supabase pg-meta API (POST /pg/query)
 * Uses service role key — no need for access token or psql.
 */
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const sqlFile = path.join(__dirname, "..", "supabase", "migrations", "20260211_create_web_orders.sql");
const sql = fs.readFileSync(sqlFile, "utf-8");

async function run() {
    console.log("📦 Aplicando migração web_orders via pg-meta API...\n");

    // Try pg-meta endpoint first
    const endpoints = [
        `${SUPABASE_URL}/pg/query`,
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
    ];

    for (const endpoint of endpoints) {
        console.log(`🔗 Tentando: ${endpoint}`);
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": endpoint.includes("/pg/") ? "application/json" : "application/json",
                    "apikey": SERVICE_KEY,
                    "Authorization": `Bearer ${SERVICE_KEY}`,
                },
                body: JSON.stringify(
                    endpoint.includes("/pg/")
                        ? { query: sql }
                        : { query: sql }
                ),
            });

            const text = await res.text();
            console.log(`  Status: ${res.status}`);

            if (res.ok) {
                console.log(`  ✅ Migração aplicada com sucesso!`);
                console.log(`  Response: ${text.substring(0, 500)}`);

                // Verify table exists
                const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/web_orders?select=count&limit=0`, {
                    headers: {
                        "apikey": SERVICE_KEY,
                        "Authorization": `Bearer ${SERVICE_KEY}`,
                    },
                });
                if (verifyRes.ok) {
                    console.log("\n✅ Tabela web_orders criada e acessível!");
                } else {
                    console.log(`\n⚠️  Tabela pode precisar de tempo para propagar: ${verifyRes.status}`);
                }
                return;
            } else {
                console.log(`  ❌ Erro: ${text.substring(0, 300)}`);
            }
        } catch (err) {
            console.log(`  ❌ ${err.message}`);
        }
    }

    // If all endpoints fail, try splitting SQL and using individual PostgREST table creation
    console.log("\n⚠️  Nenhum endpoint funcionou.");
    console.log("💡 Alternativa: cole o SQL no Supabase Dashboard → SQL Editor");
    console.log(`   URL: ${SUPABASE_URL.replace('.supabase.co', '.supabase.com')}/project/rrzgawssbyfzbkmtcovz/sql`);
    console.log(`\n   Arquivo SQL: ${sqlFile}`);
}

run().catch(console.error);
