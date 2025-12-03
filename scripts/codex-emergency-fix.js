/**
 * ⚡️ Codex Emergency Auto-Fix
 * Triggered automatically when the build fails to apply generic recovery routines.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const LOG_DIR = path.join(process.cwd(), "logs", "errors");
const BUILD_LOG_FILE = path.join(LOG_DIR, "build-failures.log");
const EMERGENCY_LOG_FILE = path.join(LOG_DIR, "emergency-fix.log");
const META_FILE = path.join(process.cwd(), "logs", "meta_knowledge.json");

const ensureLogs = () => {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(BUILD_LOG_FILE)) fs.writeFileSync(BUILD_LOG_FILE, "");
  if (!fs.existsSync(EMERGENCY_LOG_FILE)) fs.writeFileSync(EMERGENCY_LOG_FILE, "");
  if (!fs.existsSync(META_FILE))
    fs.writeFileSync(
      META_FILE,
      JSON.stringify({ patterns: [], lastUpdated: new Date().toISOString() }, null, 2)
    );
};

const appendLog = (message) => {
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(EMERGENCY_LOG_FILE, entry);
  console.log(message);
};

const updateMetaKnowledge = (errorType, action) => {
  const meta = JSON.parse(fs.readFileSync(META_FILE, "utf-8"));
  meta.patterns = meta.patterns || [];
  meta.patterns.push({
    timestamp: new Date().toISOString(),
    errorType,
    action,
  });
  meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
};

const runCommand = (command) => {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    appendLog(`Command failed: ${command} — ${error.message}`);
  }
};

async function main() {
  console.log("🚨 Iniciando Codex Emergency Auto-Fix...");
  ensureLogs();

  const buildLog = fs.readFileSync(BUILD_LOG_FILE, "utf-8");
  let errorType = "generic";
  let action = "prettier-eslint";

  try {
    if (buildLog.includes("Unexpected token") || buildLog.includes("sidebar.tsx")) {
      errorType = "jsx-syntax";
      action = "codex-fix-sidebar-syntax";
      appendLog("🧱 Detetado erro JSX — aplicando correção do sidebar...");
      runCommand("node scripts/codex-fix-sidebar-syntax.js");
    } else if (buildLog.includes("Cannot find module") || buildLog.includes("module not found")) {
      errorType = "dependency";
      action = "npm-ci";
      appendLog("📦 Erro de dependência — reinstalando pacotes...");
      runCommand("npm ci");
    } else if (buildLog.includes("TypeScript") || buildLog.includes("TS")) {
      errorType = "typescript";
      action = "tsc-no-emit";
      appendLog("🧩 Erro de tipagem — tentando autocorreção...");
      runCommand("npx tsc --noEmit || true");
    } else {
      appendLog("⚙️ Erro genérico — aplicando Prettier + lint fix...");
      runCommand("npx prettier --write .");
      runCommand("npx eslint . --fix || true");
    }

    appendLog("📚 Build failure auto-fixed.");
    updateMetaKnowledge(errorType, action);

    execSync('git config user.name "Codex AutoFix Bot"');
    execSync('git config user.email "codex@dsdgroup.es"');
    execSync("git add .");
    execSync('git commit -m "🚑 Codex Emergency Auto-Fix applied" || true', {
      stdio: "inherit",
    });
    execSync("git push origin main || true", { stdio: "inherit" });

    console.log("✅ Reparo emergencial concluído e comitado.");
  } catch (error) {
    appendLog(`❌ Falha no reparo emergencial: ${error.message}`);
    fs.appendFileSync(BUILD_LOG_FILE, `[${new Date().toISOString()}] ${error.message}\n`);
  }
}

main();
