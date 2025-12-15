import { createClient } from "@supabase/supabase-js";
import fs from "fs";
function parseCsv(csv: string): Record<string, string>[] {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const headers = parseCsvLine(rows[0]);

  return rows.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  const regex = /(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const value = (match[1] ?? match[2] ?? "").replace(/""/g, "\"");
    values.push(value.trim());
  }

  return values;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function seed() {
  const csv = fs.readFileSync("./data/AP_DB.csv", "utf8");
  const data = parseCsv(csv);

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
