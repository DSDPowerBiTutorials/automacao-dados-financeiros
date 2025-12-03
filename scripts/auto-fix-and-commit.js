import fs from "fs";
import { execSync } from "child_process";

console.log("🧩 Codex Auto-Fix iniciado...");

try {
  const files = execSync("git ls-files '*.ts' '*.tsx' '*.js' '*.jsx'").toString().split("\n");

  files.forEach((file) => {
    if (!file) return;
    let content = fs.readFileSync(file, "utf-8");
    const original = content;

    content = content
      .replace(/<<<<<<<.*?=======|>>>>>>>.*?\n/gms, "")
      .replace(/\n{3,}/g, "\n\n");

    if (!content.includes('"use client"') && file.endsWith(".tsx")) {
      content = `"use client";\n${content}`;
    }

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`✅ Corrigido: ${file}`);
    }
  });

  execSync("npx prettier --write .", { stdio: "inherit" });
  execSync('git config user.name "Codex AutoFix Bot"');
  execSync('git config user.email "codex@dsdgroup.es"');
  execSync("git add .");
  execSync('git commit -m "🤖 auto-fix: syntax & formatting" || true');
  execSync("git push origin main || true");

  console.log("🚀 Auto-fix concluído com sucesso!");
} catch (err) {
  console.error("❌ Erro no auto-fix:", err.message);
  process.exit(1);
}
