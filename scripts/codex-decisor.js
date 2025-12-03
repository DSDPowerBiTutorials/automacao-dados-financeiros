import fs from "fs/promises";
import { execSync } from "child_process";

async function main() {
  console.log("🤖 Codex Decisor iniciando...");

  const logs = await fs.readdir("logs/errors");
  const latest = logs.sort().pop();

  if (!latest) {
    console.log("✅ Nenhum erro pendente. Tudo limpo!");
    return;
  }

  const content = await fs.readFile(`logs/errors/${latest}`, "utf-8");

  if (content.includes("Syntax Error") || content.includes("Unexpected token")) {
    console.log("🩺 Erro sintático detectado. Executando auto-fix...");
    execSync("node scripts/auto-fix-and-commit.js", { stdio: "inherit" });
  } else if (content.includes("Supabase") || content.includes("upload")) {
    console.log("💾 Erro de integração Supabase detectado. Validando...");
    execSync("node scripts/codex-validate-supabase.js", { stdio: "inherit" });
  } else {
    console.log("🤷 Nenhum padrão reconhecido. Apenas registrando aprendizado.");
  }

  console.log("🧠 Atualizando conhecimento...");
  execSync("node scripts/codex-log-learning.js", { stdio: "inherit" });
  execSync(
    'git add logs/meta_knowledge.json && git commit -m "🧠 learned: new fix pattern" || true',
    { stdio: "inherit" }
  );
  execSync("git push origin main || true");
}

main().catch((err) => {
  console.error("❌ Falha no Codex Decisor:", err);
  process.exit(1);
});
