import fs from "fs/promises";
import path from "path";

const LOGS_DIR = "logs/errors";
const META_FILE = "logs/meta_knowledge.json";

async function main() {
  console.log("🧠 Atualizando base de aprendizado do Codex...");

  await fs.mkdir("logs", { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });

  const files = await fs.readdir(LOGS_DIR);
  const meta = { learned_patterns: [], last_update: new Date().toISOString() };

  for (const file of files) {
    if (!file.endsWith(".log") && !file.endsWith(".json")) continue;
    const content = await fs.readFile(path.join(LOGS_DIR, file), "utf-8");
    meta.learned_patterns.push({
      file,
      summary: content.slice(0, 150),
      learned: true,
    });
  }

  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2));
  console.log("✅ Base de conhecimento atualizada com sucesso.");
}

main().catch((err) => {
  console.error("❌ Falha ao atualizar aprendizado:", err);
  process.exit(1);
});
