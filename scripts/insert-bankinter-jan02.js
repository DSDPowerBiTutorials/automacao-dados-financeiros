#!/usr/bin/env node
/**
 * Insert missing Bankinter EUR transactions for 2026-01-02
 * Run: node scripts/insert-bankinter-jan02.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATE = "2026-01-02";
const SOURCE = "bankinter-eur";
const FILE_NAME = "manual-insert-jan02-2026";

const transactions = [
    { description: "Recibo/grenke rent slu", amount: -87.47, saldo: 122313.92, category: "Recibos" },
    { description: "Recib/telefonica moviles espa", amount: -992.60, saldo: 122401.39, category: "Recibos" },
    { description: "Recib/telefonica moviles espa", amount: -23.50, saldo: 123393.99, category: "Recibos" },
    { description: "Transf/paypal europe s.a.r.l.", amount: 1516.97, saldo: 123417.49, category: "Transferencias" },
    { description: "Transf/paypal europe s.a.r.l.", amount: 533.70, saldo: 121900.52, category: "Transferencias" },
    { description: "Recibo/bredent group spain sl", amount: -86.79, saldo: 121366.82, category: "Recibos" },
    { description: "Recibo/proclinic, s.a.", amount: -4425.36, saldo: 121453.61, category: "Recibos" },
    { description: "Recib/telefonica moviles espa", amount: -36.30, saldo: 125878.97, category: "Recibos" },
    { description: "Recib/telefonica moviles espa", amount: -23.50, saldo: 125915.27, category: "Recibos" },
    { description: "Recib/telefonica moviles espa", amount: -23.50, saldo: 125938.77, category: "Recibos" },
    { description: "Recibo/iberent technology", amount: -171.03, saldo: 125962.27, category: "Recibos" },
    { description: "Recibo/megagen iberia sl", amount: -96.80, saldo: 126133.30, category: "Recibos" },
    { description: "Recibo/megagen iberia sl", amount: -228.80, saldo: 126230.10, category: "Recibos" },
    { description: "Recib/pleo financial services", amount: -5000.00, saldo: 126458.90, category: "Recibos" },
    { description: "Recib/de lage landen internat", amount: -1358.06, saldo: 131458.90, category: "Recibos" },
    { description: "Recib/de lage landen internat", amount: -78.71, saldo: 132816.96, category: "Recibos" },
    { description: "Recib/de lage landen internat", amount: -46.37, saldo: 132895.67, category: "Recibos" },
    { description: "Recib/implant protesis dental", amount: -28.44, saldo: 132942.04, category: "Recibos" },
    { description: "Trans/paypal (europe) s.a r.l", amount: 2450.54, saldo: 132970.48, category: "Transferencias" },
    { description: "Trans/paypal (europe) s.a r.l", amount: 1383.71, saldo: 130519.94, category: "Transferencias" },
    { description: "Comis serv tarifa plana/31-12", amount: -20.00, saldo: 129136.23, category: "Transferencias" },
];

async function main() {
    console.log(`\n📋 Inserting ${transactions.length} Bankinter EUR transactions for ${DATE}...\n`);

    // Check for existing rows to avoid duplicates
    const { data: existing } = await supabase
        .from("csv_rows")
        .select("date, description, amount")
        .eq("source", SOURCE)
        .eq("date", DATE);

    const existingKeys = new Set(
        (existing || []).map(r => `${r.date}|${r.description}|${r.amount}`)
    );

    const rows = transactions
        .filter(tx => {
            const key = `${DATE}|${tx.description}|${tx.amount}`;
            if (existingKeys.has(key)) {
                console.log(`  ⏭️  Skip (exists): ${tx.description} ${tx.amount}`);
                return false;
            }
            return true;
        })
        .map((tx, index) => ({
            source: SOURCE,
            file_name: FILE_NAME,
            date: DATE,
            description: tx.description,
            amount: tx.amount.toString(),
            category: tx.category,
            classification: tx.category,
            reconciled: false,
            custom_data: {
                fecha_contable: "02/01/2026",
                fecha_contable_iso: DATE,
                fecha_valor: "02/01/2026",
                fecha_valor_iso: DATE,
                debe: tx.amount < 0 ? Math.abs(tx.amount) : 0,
                haber: tx.amount > 0 ? tx.amount : 0,
                importe: tx.amount,
                saldo: tx.saldo,
                referencia: "",
                clave: "",
                categoria: tx.category,
                row_index: index + 2,
                file_name: FILE_NAME,
            },
        }));

    if (rows.length === 0) {
        console.log("\n✅ All transactions already exist. Nothing to insert.");
        return;
    }

    console.log(`\n📊 New rows to insert: ${rows.length}`);

    const { data, error } = await supabase
        .from("csv_rows")
        .insert(rows)
        .select("id, date, description, amount");

    if (error) {
        console.error("❌ Insert error:", error);
        process.exit(1);
    }

    console.log(`\n✅ Successfully inserted ${data.length} transactions:`);
    data.forEach(r => console.log(`  ${r.date} | ${r.description} | ${r.amount}`));
}

main().catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
});
