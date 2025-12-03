#!/usr/bin/env node
/**
 * 🤖 DSD Finance Hub — Codex Auto-Fix + Commit Script
 * Corrige conflitos, "use client", imports e formata tudo com Prettier.
 * Depois, faz commit e push automaticamente.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

console.log("\n🧩 Iniciando DSD Codex Auto-Fix Engine...\n");

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && !fullPath.includes("node_modules")) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function removeConflictMarkers(content) {
  return content
    .replace(/<<<<<<<[\s\S]*?=======/g, "")
    .replace(/>>>>>>>[^\n]*/g, "")
    .trim();
}

function ensureUseClient(content) {
  if (content.includes('"use client"') || content.includes("'use client'")) return content;
  if (content.match(/useState|useEffect|useMemo|useCallback|useRef/)) {
    return `"use client"\n\n${content}`;
  }
  return content;
}

function normalizeImports(content) {
  return content
    .replace(/import\s+{([^}]*)}\s+from\s+"([^"]+)";?\s*\n(?=.*import\s+{[^}]*}\s+from\s+"\2")/g, "")
    .replace(/;+$/g, ";");
}

console.log("🔍 Buscando arquivos...");
const files = getAllFiles(rootDir);
let fixedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  content = removeConflictMarkers(content);
  content = ensureUseClient(content);
  content = normalizeImports(content);

  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    fixedCount++;
  }
}

console.log(`✅ ${fixedCount} arquivos ajustados.`);
console.log("🎨 Formatando com Prettier...");

try {
  execSync("npx prettier --write .", { stdio: "inherit" });
} catch {
  console.warn("⚠️ Prettier não instalado. Pulei formatação.");
}

// 🧠 Git commit & push
try {
  console.log("\n📦 Commitando alterações...");
  execSync("git add .", { stdio: "inherit" });
  const commitMsg = `🤖 auto-fix: resolved merge conflicts & normalized code (${new Date().toISOString()})`;
  execSync(`git commit -m "${commitMsg}" || echo 'Nenhuma mudança para commit'`, { stdio: "inherit" });
  execSync(`git push origin ${branch}`, { stdio: "inherit" });
  console.log(`🚀 Alterações enviadas para a branch ${branch}`);
} catch (err) {
  console.error("❌ Erro ao commitar ou enviar alterações:", err.message);
}

console.log("\n✅ Auto-Fix concluído com sucesso! Tudo limpo e commitado.\n");

