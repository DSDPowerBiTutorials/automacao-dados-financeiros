import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import Papa from "papaparse";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function seed() {
  const csv = fs.readFileSync("./data/AP_DB.csv", "utf8");
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  for (const row of data) {
    const fornecedorNome = row["Provider"];
    const contaDescricao = row["Financial Big Line"];
    const valor = parseFloat(
      (row["EUR Ex AP Budget"] || "0").replace(",", "."),
    );
    const status = (row["Status"] as string) || "Pending";
    const bankAccount = row["Bank Account"] || null;

    const { data: fornecedor } = await supabase
      .from("fornecedores")
      .upsert({ nome: fornecedorNome }, { onConflict: "nome" })
      .select()
      .single();

    const { data: conta } = await supabase
      .from("contas_gerenciais")
      .upsert({ descricao: contaDescricao }, { onConflict: "descricao" })
      .select()
      .single();

    await supabase.from("despesas").insert({
      data_vencimento: row["Invoice Date"],
      descricao: row["Financial Sub-Group"],
      valor,
      fornecedor_id: fornecedor?.id,
      conta_gerencial_id: conta?.id,
      status,
      bank_account: bankAccount,
      conciliated: status === "Paid",
    });
  }
  console.log("✅ Contas a pagar seed concluído com sucesso!");
}

seed().catch((err) => {
  console.error("❌ Erro ao executar seed de contas a pagar:", err);
});
