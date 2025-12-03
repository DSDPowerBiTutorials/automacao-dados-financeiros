import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";

const API_PATH = "src/pages/api/upload-bankinter-eur.ts";

async function main() {
  console.log("🚀 Criando endpoint autodidata do Bankinter EUR...");

  const templatePath = path.join(process.cwd(), API_PATH);
  let content = "";

  try {
    content = await fs.readFile(templatePath, "utf-8");
  } catch (error) {
    console.error("❌ Template do endpoint não encontrado:", error);
    process.exit(1);
  }

  await fs.mkdir(path.dirname(API_PATH), { recursive: true });
  await fs.writeFile(API_PATH, content);
  console.log("✅ Endpoint criado e salvo com sucesso!");

  execSync(`npx prettier --write ${API_PATH}`);
  execSync(`git config user.name "Codex AutoFix Bot"`);
  execSync(`git config user.email "codex@dsdgroup.es"`);
  execSync(`git add ${API_PATH}`);
  execSync(
    'git commit -m "🧠 feat: Bankinter EUR autodidata upload endpoint" || true',
  );

  try {
    execSync("git push origin main");
    console.log("🚀 Código enviado com sucesso!");
  } catch {
    console.log("⚠️ Nenhum push realizado (talvez sem permissão direta).");
  }
}

main().catch((e) => console.error("❌ Erro:", e));
