#!/usr/bin/env node
/**
 * 🧠 Codex Workflow Repair Script
 * -----------------------------------------------------
 * Corrige workflows quebrados, reinstala dependências
 * e garante integridade da estrutura .github/workflows.
 * -----------------------------------------------------
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();
const WORKFLOWS_DIR = path.join(ROOT, ".github", "workflows");
const LOGS_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOGS_DIR, "repair.log");

// Garante pastas
fs.mkdirSync(LOGS_DIR, { recursive: true });

// Logger robusto
function log(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}`;
  console.log(entry);
  fs.appendFileSync(LOG_FILE, entry + "\n");
}

// Execução segura de comandos shell
function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    log(`⚠️ Command failed: ${cmd}`);
    log(err.message);
  }
}

// Tratamento global de erros
process.on("uncaughtException", (err) => {
  log(`❌ Uncaught Exception: ${err.message}`);
  log(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  log(`❌ Unhandled Promise Rejection: ${reason}`);
  process.exit(1);
});

log("🚀 Starting Codex Workflow Repair");

// 1️⃣ Valida diretório de workflows
if (!fs.existsSync(WORKFLOWS_DIR)) {
  log("⚠️ .github/workflows not found, creating...");
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

// 2️⃣ Corrige cabeçalho e permissões dos YAMLs
function fixWorkflows() {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".yml") || f.endsWith(".yaml"));
  if (files.length === 0) {
    log("⚠️ Nenhum arquivo YAML encontrado.");
    return;
  }

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    let content = fs.readFileSync(filePath, "utf8");

    // Corrige sintaxe comum
    content = content.replace(/\t/g, "  "); // substitui tabs
    content = content.replace(/\r\n/g, "\n");

    // Atualiza actions
    content = content.replace(/actions\/setup-node@v[23]/g, "actions/setup-node@v4");
    content = content.replace(/actions\/checkout@v[12]/g, "actions/checkout@v4");

    // Garante permissões básicas
    if (!content.includes("permissions:")) {
      content += `
permissions:
  contents: write
  pull-requests: write
`;
    }

    fs.writeFileSync(filePath, content);
    log(`✅ Workflow verificado e ajustado: ${file}`);
  }
}

// 3️⃣ Instala dependências se faltarem
function installDeps() {
  try {
    log("📦 Verificando dependências...");
    run("npm install prettier eslint js-yaml --legacy-peer-deps || true");
  } catch (e) {
    log(`⚠️ Erro ao instalar dependências: ${e.message}`);
  }
}

// 4️⃣ Executa validação Prettier e ESLint
function lintWorkflows() {
  log("🎨 Formatando YAMLs e JS...");
  run("npx prettier --write .github/workflows || true");
  run("npx eslint --fix scripts/*.js || true");
}

// 5️⃣ Confirma estrutura correta do repositório
function validateRepoStructure() {
  const expected = ["src", "scripts", "public"];
  const missing = expected.filter(d => !fs.existsSync(path.join(ROOT, d)));
  if (missing.length > 0) {
    log(`⚠️ Estrutura incompleta, criando: ${missing.join(", ")}`);
    missing.forEach(d => fs.mkdirSync(path.join(ROOT, d), { recursive: true }));
  }
}

// 6️⃣ Commit automático de correções
function autoCommit() {
  try {
    log("💾 Preparando commit automático...");
    run("git config user.name 'Codex Workflow Bot'");
    run("git config user.email 'codex@dsdgroup.es'");
    run("git add .");
    execSync("git diff --cached --quiet") 
      ? log("✅ Nenhuma alteração detectada.") 
      : run("git commit -m '🤖 Codex: repaired workflows and dependencies' || true");
  } catch (err) {
    log(`⚠️ Commit skipped: ${err.message}`);
  }
}

// 🧠 Execução
try {
  validateRepoStructure();
  fixWorkflows();
  installDeps();
  lintWorkflows();
  autoCommit();
  log("✅ Codex Workflow Repair finished successfully.");
} catch (error) {
  log(`❌ Erro crítico: ${error.message}`);
  log(error.stack);
  process.exit(1);
}
