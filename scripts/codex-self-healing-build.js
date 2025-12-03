import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const TARGET_DIR = "src";

function walk(dir, callback) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, callback);
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
      callback(fullPath);
  });
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");

  content = content
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/^[\s,|>]*\|.*$/gm, "")
    .replace(/^[\s,|>]*->.*$/gm, "")
    .replace(/^[\s,|>]*,-?.*$/gm, "")
    .replace(/^[\s]*```$/gm, "")
    .replace(/^,+/, "")
    .replace(/^>+/, "")
    .replace(/\r/g, "");

  if (!content.trimStart().startsWith('"use client"'))
    content = `"use client"\n\n${content.trim()}`;

  fs.writeFileSync(filePath, content);
  console.log(`✅ Corrigido: ${filePath}`);
}

function runCommand(cmd, silent = false) {
  try {
    execSync(cmd, { stdio: silent ? "ignore" : "inherit" });
  } catch (err) {
    console.warn(`⚠️ Falha ao executar: ${cmd}`);
  }
}

async function main() {
  console.log("🧠 Iniciando rotina de autocorreção do Codex...");

  walk(TARGET_DIR, fixFile);

  console.log("✨ Formatando com Prettier...");
  runCommand("npx prettier --write src", true);

  console.log("🚀 Commitando alterações...");
  runCommand(`git config user.name "Codex Self-Healing Bot"`);
  runCommand(`git config user.email "codex@dsdgroup.es"`);
  runCommand("git add src");
  runCommand(
    `git commit -m "🤖 fix: Codex auto-healing build correction" || echo "No changes"`,
  );

  console.log("📤 Enviando alterações...");
  runCommand("git push origin main || true");

  console.log("✅ Correções aplicadas e commit enviado.");
}

main().catch((e) => {
  console.error("❌ Erro no self-healing:", e);
  process.exit(1);
});
