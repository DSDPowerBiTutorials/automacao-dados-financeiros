import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🧪 Validando integridade Supabase...");

  const { data, error } = await supabase.from("csv_rows").select("*").limit(5);
  if (error) {
    console.error("❌ Falha Supabase:", error.message);
    await fs.writeFile(
      `logs/errors/supabase-validation-${Date.now()}.log`,
      `Supabase validation failed:\n${error.message}`
    );
    return;
  }

  console.log(`✅ Supabase OK (${data.length} linhas validadas).`);
}

main().catch(async (e) => {
  console.error("❌ Erro geral:", e.message);
  await fs.writeFile(
    `logs/errors/supabase-general-${Date.now()}.log`,
    `General failure:\n${e.message}`
  );
});
