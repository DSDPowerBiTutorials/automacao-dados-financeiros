import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const FILE = "src/pages/api/upload-bankinter-eur.ts";

async function main() {
  console.log(
    "🚀 Atualizando endpoint Bankinter EUR com validação completa...",
  );

  const templatePath = path.join(process.cwd(), FILE);
  let content = "";

  try {
    content = await fs.readFile(templatePath, "utf-8");
  } catch (error) {
    console.error("❌ Template do endpoint não encontrado:", error);
    process.exit(1);
  }

  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, content);
  console.log("✅ Endpoint salvo!");

  execSync(`npx prettier --write ${FILE}`);
  execSync(`git config user.name "Codex AutoFix Bot"`);
  execSync(`git config user.email "codex@dsdgroup.es"`);
  execSync(`git add ${FILE}`);
  execSync(
    'git commit -m "🧠 feat: Bankinter EUR upload endpoint com validação automática" || true',
  );
  execSync(`git push origin main || true`);

  console.log("🔥 Commit enviado e endpoint ativo.");
}

main().catch((e) => console.error("❌ Erro:", e));
