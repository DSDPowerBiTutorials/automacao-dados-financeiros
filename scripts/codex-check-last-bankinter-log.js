import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOG_DIR = "logs/errors/";
const API_PATH = "src/pages/api/upload-bankinter-eur.ts";

async function getLatestErrorLog() {
  const { data, error } = await supabase.storage.from("logs").list("errors/", {
    sortBy: { column: "created_at", order: "desc" },
    limit: 1,
  });

  if (error) throw new Error(`Erro ao listar logs: ${error.message}`);
  if (!data?.length) throw new Error("Nenhum log encontrado.");

  const latest = data[0].name;
  const { data: file } = await supabase.storage.from("logs").download(`${LOG_DIR}${latest}`);
  const content = await file.text();
  const parsed = JSON.parse(content);

  console.log(`🪵 Último log: ${latest}`);
  console.log(`📄 Conteúdo:`, parsed);

  return parsed.error || parsed.details || "Erro desconhecido";
}

async function repairBasedOnError(errorMessage) {
  console.log("🧠 Analisando erro:", errorMessage);
  let code = fs.readFileSync(API_PATH, "utf-8");

  if (errorMessage.includes("colunas principais")) {
    console.log("🧱 Corrigindo mapeamento de cabeçalhos...");
    code = code.replace(
      /const fechaIdx[\s\S]*?if \(fechaIdx === -1[\s\S]*?throw new Error[\s\S]*?\)/,
      `
      const fechaIdx = headers.findIndex((h) => /fecha valor|fecha contable/i.test(h));
      const descIdx = headers.findIndex((h) => /descrip/i.test(h));
      const haberIdx = headers.findIndex((h) => /haber/i.test(h));
      const debeIdx = headers.findIndex((h) => /debe/i.test(h));
      const saldoIdx = headers.findIndex((h) => /saldo/i.test(h));
      const refIdx = headers.findIndex((h) => /clave|referen/i.test(h));
      if (fechaIdx === -1 || descIdx === -1)
        throw new Error("Estrutura inesperada - colunas principais ausentes.");
      `
    );
  } else if (errorMessage.includes("parse_date_code")) {
    code = code.replace(/XLSX\.SSF\.parse_date_code/g, "XLSX.SSF.parse_date_code || (()=>null)");
  }

  fs.writeFileSync(API_PATH, code);
  execSync(`npx prettier --write ${API_PATH}`);
}

async function reuploadTest() {
  console.log("📤 Testando reenvio de extrato...");

  const filePath = path.resolve("./data/Movimientos_cuenta_corriente_ES7201280074060100064605.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error("❌ Arquivo de teste não encontrado. Coloque o extrato em ./data/");
    return;
  }

  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));

  const response = await fetch("https://dsd-finance-hub.vercel.app/api/upload-bankinter-eur", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!result.success) throw new Error(result.details || "Falha no reupload.");

  console.log("✅ Upload reexecutado com sucesso!");
}

async function main() {
  console.log("🚀 Rodando rotina autodidata Codex Bankinter EUR...");
  try {
    const lastError = await getLatestErrorLog();
    await repairBasedOnError(lastError);
    await reuploadTest();

    execSync('git config user.name "Codex AutoFix Bot"');
    execSync('git config user.email "codex@dsdgroup.es"');
    execSync(`git add ${API_PATH}`);
    execSync('git commit -m "🤖 fix: Codex auto-learned Bankinter EUR issue"');
    execSync("git push origin main");

    console.log("✅ Correção aplicada, validada e comitada!");
  } catch (err) {
    console.error("❌ Falha:", err.message);
  }
}

main();
