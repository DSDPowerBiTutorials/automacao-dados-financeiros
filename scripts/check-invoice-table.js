#!/usr/bin/env node
/**
 * Script para verificar se a tabela Invoice do HubSpot tem dados
 * 
 * Verifica:
 * 1. Se a tabela Invoice existe no SQL Server
 * 2. Quantos registros existem
 * 3. Exemplo de dados (invoice_number, invoice_date, etc.)
 * 4. Se há associações com Deal
 */

import "dotenv/config";

async function main() {
    console.log("🔍 Verificando tabela Invoice no HubSpot SQL Server...\n");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Queries para verificar a tabela Invoice
    const queries = [
        {
            name: "1️⃣ Contagem total de Invoices",
            sql: `SELECT COUNT(*) AS total FROM Invoice`
        },
        {
            name: "2️⃣ Invoices com data (válidas)",
            sql: `SELECT COUNT(*) AS total FROM Invoice WHERE hs_invoice_date IS NOT NULL`
        },
        {
            name: "3️⃣ Últimas 10 Invoices",
            sql: `SELECT TOP 10
        i.InvoiceId,
        i.hs_unique_id AS invoice_number,
        i.hs_invoice_date AS invoice_date,
        i.hs_amount_billed AS amount_billed,
        i.hs_amount_paid AS amount_paid,
        i.hs_invoice_status AS status,
        i.hs_invoice_latest_contact_email AS email
      FROM Invoice i
      WHERE i.hs_invoice_date IS NOT NULL
      ORDER BY i.hs_invoice_date DESC`
        },
        {
            name: "4️⃣ Associações Invoice ↔ Deal",
            sql: `SELECT COUNT(*) AS total FROM InvoiceDealAssociations`
        },
        {
            name: "5️⃣ Invoices linkadas a Deals",
            sql: `SELECT TOP 10
        i.hs_unique_id AS invoice_number,
        i.hs_invoice_date AS invoice_date,
        d.dealname AS order_code,
        d.closedate AS order_date,
        d.amount AS deal_amount,
        i.hs_amount_billed AS invoice_amount
      FROM Invoice i
      INNER JOIN InvoiceDealAssociations ida ON i.InvoiceId = ida.InvoiceId
      INNER JOIN Deal d ON d.DealId = ida.DealId
      WHERE i.hs_invoice_date IS NOT NULL
      ORDER BY i.hs_invoice_date DESC`
        },
        {
            name: "6️⃣ Buscar invoice específica (38f776d)",
            sql: `SELECT TOP 10
        i.hs_unique_id AS invoice_number,
        i.hs_invoice_date AS invoice_date,
        d.dealname AS order_code,
        d.closedate AS order_date
      FROM Invoice i
      LEFT JOIN InvoiceDealAssociations ida ON i.InvoiceId = ida.InvoiceId
      LEFT JOIN Deal d ON d.DealId = ida.DealId
      WHERE i.hs_unique_id LIKE '%38F776D%' OR d.dealname LIKE '%38f776d%'`
        }
    ];

    for (const query of queries) {
        console.log(`\n${query.name}`);
        console.log("─".repeat(50));

        try {
            const response = await fetch(`${baseUrl}/api/hubspot/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query.sql })
            });

            if (!response.ok) {
                const text = await response.text();
                console.log(`❌ Erro: ${response.status} - ${text.substring(0, 200)}`);
                continue;
            }

            const data = await response.json();

            if (data.error) {
                console.log(`❌ Erro SQL: ${data.error}`);
                continue;
            }

            if (!data.data || data.data.length === 0) {
                console.log("📭 Nenhum resultado encontrado");
                continue;
            }

            // Mostrar resultados
            if (data.data.length === 1 && data.data[0].total !== undefined) {
                console.log(`📊 Total: ${data.data[0].total}`);
            } else {
                console.table(data.data);
            }

        } catch (err) {
            console.log(`❌ Erro de conexão: ${err.message}`);
        }
    }

    console.log("\n" + "═".repeat(50));
    console.log("✅ Verificação concluída!");
    console.log("\nSe a tabela Invoice tiver dados, precisamos:");
    console.log("1. Atualizar o sync para trazer invoice_number e invoice_date");
    console.log("2. Fazer JOIN Deal ↔ Invoice via InvoiceDealAssociations");
}

main().catch(console.error);
