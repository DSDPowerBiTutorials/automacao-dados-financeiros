/**
 * 🤖 Codex Script: Fix "trim is not a function" globally
 * ------------------------------------------------------
 * This script scans the repository for `.trim(` usages and ensures that
 * only strings are passed to trim(), replacing unsafe calls with
 * `String(value ?? "").trim()`.
 */

import fs from "fs";
import path from "path";

const TARGET_DIRS = ["src/app", "src/lib", "src/services", "scripts"];
const FILE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function getAllFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else if (FILE_EXTENSIONS.some(ext => file.endsWith(ext))) {
      results.push(fullPath);
    }
  });
  return results;
}

function fixTrimCalls(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  // Regex para capturar chamadas `.trim()` em variáveis não protegidas
  const regex = /([a-zA-Z0-9_.\[\]()]*)\.trim\s*\(\s*\)/g;

  let modified = false;
  const newContent = content.replace(regex, (match, variable) => {
    // Ignora se já está em formato seguro (String(...).trim())
    if (/String\s*\(/.test(variable)) return match;
    modified = true;
    return `String(${variable} ?? "").trim()`;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

function main() {
  console.log("🤖 Codex Trim Fix — scanning for unsafe .trim() calls...\n");
  let scannedCount = 0;
  let fixedCount = 0;

  TARGET_DIRS.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = getAllFiles(dir);
      files.forEach(file => {
        scannedCount += 1;
        if (fixTrimCalls(file)) fixedCount += 1;
      });
    }
  });

  console.log(`\n✅ Codex Trim Fix completed. Scanned ${scannedCount} files, fixed ${fixedCount}.`);
}

main();
