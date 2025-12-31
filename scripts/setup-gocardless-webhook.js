#!/usr/bin/env node

/**
 * Script de configuração do webhook do GoCardless
 * Uso: node scripts/setup-gocardless-webhook.js <webhook_secret>
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");

/**
 * Atualizar o secret do webhook no .env.local
 */
function updateWebhookSecret(secret: string) {
    if (!secret || secret === "") {
        console.error("❌ Erro: Webhook secret não fornecido");
        console.log("\nUso: node scripts/setup-gocardless-webhook.js <webhook_secret>");
        console.log("\nExemplo:");
        console.log("  node scripts/setup-gocardless-webhook.js whsec_abc123def456");
        process.exit(1);
    }

    try {
        let envContent = fs.readFileSync(envPath, "utf-8");

        const pattern = /GOCARDLESS_WEBHOOK_SECRET=.*/;
        const newLine = `GOCARDLESS_WEBHOOK_SECRET=${secret}`;

        if (pattern.test(envContent)) {
            envContent = envContent.replace(pattern, newLine);
            console.log("✅ Webhook secret atualizado em .env.local");
        } else {
            envContent += `\n${newLine}\n`;
            console.log("✅ Webhook secret adicionado a .env.local");
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`\n✅ Configuração concluída!`);
        console.log(`\nPróximos passos:`);
        console.log(`1. Deploy para Vercel: git push origin main`);
        console.log(`2. GoCardless Dashboard: https://manage.gocardless.com/developers/webhooks`);
        console.log(`3. Adicionar endpoint: https://dsdfinancehub.com/api/webhooks/gocardless`);
        console.log(`4. Testar localmente: npm run dev && node scripts/test-gocardless-webhook.js`);
    } catch (error) {
        console.error("❌ Erro ao atualizar .env.local:", error);
        process.exit(1);
    }
}

const secret = process.argv[2];
updateWebhookSecret(secret);
