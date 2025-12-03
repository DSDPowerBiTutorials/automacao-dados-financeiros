#!/usr/bin/env node

/**
 * 🚀 DSD Finance Hub — Auto Fix Script
 * Corrige conflitos, "use client", imports e formata código automaticamente.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();

console.log("\n🧩 DSD Codex Auto-Fix iniciado...\n");

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory() && !fullPath.includes("node_modules")) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js")) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

// 🔧 1. Remover marcadores de conflito
function removeConflictMarkers(content) {
  return content
    .replace(/<<<<<<<[\s\S]*?=======/g, "")
    .replace(/>>>>>>>[^\n]*/g, "")
    .trim();
}

// 🔧 2. Garantir "use client" em arquivos React com hooks
function ensureUseClient(content) {
  if (content.includes("use client")) return content;
  if (content.match(/useState|useEffect|useCallback|useRef/)) {
    return `"use client"\n\n${content}`;
  }
  return content;
}

// 🔧 3. Corrigir imports duplicados ou quebrados
function normalizeImports(content) {
  return content
    .replace(/import\s+{([^}]*)}\s+from\s+"([^"]+)";?\s*\n(?=.*import\s+{[^}]*}\s+from\s+"\2")/g, "")
    .replace(/;+$/g, ";");
}

// 🚀 Executar auto-fix
const files = getAllFiles(rootDir);
let modifiedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, "utf-8");
  const original = content;
  content = removeConflictMarkers(content);
  content = ensureUseClient(content);
  content = normalizeImports(content);
  if (content !== original) {
    fs.writeFileSync(file, content, "utf-8");
    modifiedCount++;
  }
});

console.log(`✅ ${modifiedCount} arquivos corrigidos.`);

// 🧹 Rodar Prettier (se instalado)
try {
  console.log("\n🎨 Formatando código com Prettier...");
  execSync("npx prettier --write .", { stdio: "inherit" });
} catch {
  console.log("⚠️ Prettier não encontrado. Pulei essa etapa.");
}

console.log("\n🤖 Correções automáticas finalizadas com sucesso!");
