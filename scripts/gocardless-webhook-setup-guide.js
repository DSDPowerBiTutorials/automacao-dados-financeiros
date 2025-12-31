#!/usr/bin/env node

/**
 * Setup Webhook GoCardless - Quick Start Guide
 * 
 * Este script fornece um passo-a-passo para configurar o webhook do GoCardless
 */

const chalk = require("chalk");

const steps = [
    {
        title: "1. Acesse o GoCardless Dashboard",
        commands: [
            "Abra: https://manage.gocardless.com",
            "Faça login com suas credenciais",
            "Vá para: Settings > Webhooks (na seção de Developers)",
        ],
    },
    {
        title: "2. Crie um novo Webhook Endpoint",
        commands: [
            "Clique em 'Add Endpoint'",
            "Cole a URL: https://dsdfinancehub.com/api/webhooks/gocardless",
            "Clique em 'Create Endpoint'",
        ],
    },
    {
        title: "3. Copie o Webhook Secret",
        commands: [
            "⚠️  IMPORTANTE: O GoCardless mostra o secret apenas UMA VEZ",
            "Copie exatamente (ctrl+c): whsec_...",
            "Não compartilhe este secret com ninguém!",
        ],
    },
    {
        title: "4. Configure o Secret Localmente",
        commands: [
            'Execute: node scripts/setup-gocardless-webhook.js "whsec_seu_secret_aqui"',
            "Exemplo: node scripts/setup-gocardless-webhook.js whsec_abc123def456",
            "Verifique .env.local para confirmar",
        ],
    },
    {
        title: "5. Selecione os Eventos",
        commands: [
            "No GoCardless Dashboard, escolha os eventos:",
            "  ✅ payout_created, payout_paid, payout_failed",
            "  ✅ payment_created, payment_confirmed, payment_failed",
            "  ✅ refund_created, refund_refunded, refund_failed",
            "  ✅ mandate_created, mandate_active, mandate_cancelled",
            "Clique em 'Create Endpoint' ou 'Update'",
        ],
    },
    {
        title: "6. Teste Localmente",
        commands: [
            "npm run dev",
            "Em outro terminal: node scripts/test-gocardless-webhook.js",
            "Você deve ver 4 testes passando",
        ],
    },
    {
        title: "7. Deploy para Produção",
        commands: [
            "git add -A",
            'git commit -m "feat: Add GoCardless webhook implementation"',
            "git push origin main",
            "Aguarde o deploy do Vercel",
            "Verifique em: Vercel > Deployments > Function Logs",
        ],
    },
    {
        title: "8. Teste no GoCardless Dashboard",
        commands: [
            "Volte ao GoCardless Dashboard > Webhooks",
            "Selecione seu endpoint",
            "Clique em 'Send Test'",
            "Você deve ver um ✅ 'Successfully sent'",
            "Verifique os logs do Vercel para confirmar recebimento",
        ],
    },
];

function printStep(step) {
    console.log(`\n${chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
    console.log(`${chalk.green.bold(step.title)}`);
    console.log(`${chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
    step.commands.forEach((cmd) => {
        console.log(`  ${chalk.gray("•")} ${cmd}`);
    });
}

function main() {
    console.log(
        chalk.cyan.bold("\n╔══════════════════════════════════════════════════════════╗")
    );
    console.log(
        chalk.cyan.bold("║   GoCardless Webhook Setup - Quick Start Guide           ║")
    );
    console.log(
        chalk.cyan.bold("╚══════════════════════════════════════════════════════════╝")
    );

    console.log(chalk.yellow("\nℹ️  Este guia orienta você através dos 8 passos necessários"));
    console.log(chalk.yellow("   para configurar webhooks do GoCardless.\n"));

    steps.forEach(printStep);

    console.log(
        `\n${chalk.blue.bold("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`
    );
    console.log(`\n${chalk.green("✅ Pronto para começar!")}`);
    console.log(
        chalk.cyan.italic("\nDocumentação completa em: docs/GOCARDLESS-WEBHOOK-SETUP.md\n")
    );

    console.log(chalk.yellow("⚠️  Reminders importantes:"));
    console.log("  • O webhook secret é mostrado apenas uma vez pelo GoCardless");
    console.log("  • Não compartilhe o secret com ninguém");
    console.log("  • O endpoint deve ser publicamente acessível via HTTPS");
    console.log("  • Verifique os logs após cada teste\n");
}

main();
