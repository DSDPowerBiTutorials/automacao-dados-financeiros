import { supabase } from "@/lib/supabase";

export type DespesaStatus = "Pending" | "Incurred" | "Paid";

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  created_at?: string;
}

export interface ContaGerencial {
  id: string;
  codigo?: string | null;
  descricao?: string | null;
  grupo?: string | null;
  created_at?: string;
}

export interface Despesa {
  id: string;
  data_vencimento: string | null;
  descricao: string | null;
  valor: number | null;
  fornecedor_id: string | null;
  conta_gerencial_id: string | null;
  status: DespesaStatus;
  bank_account: string | null;
  conciliated: boolean;
  created_at?: string;
  fornecedores?: Fornecedor | null;
  contas_gerenciais?: ContaGerencial | null;
}

export interface BankTransaction {
  id: string;
  bank_account: string;
  date: string | null;
  description: string | null;
  amount: number | null;
  currency?: string | null;
  imported_from?: string | null;
}

export interface Conciliation {
  id: string;
  despesa_id: string;
  bank_transaction_id: string;
  matched_at?: string;
  matched_by?: string | null;
  difference?: number | null;
  notes?: string | null;
}

const ensureClient = () => {
  if (!supabase) {
    throw new Error("❌ Supabase client não configurado.");
  }
  return supabase;
};

export async function listFornecedores(): Promise<Fornecedor[]> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("fornecedores")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("❌ Erro ao listar fornecedores:", err);
    return [];
  }
}

export async function upsertFornecedor(
  payload: Partial<Fornecedor>,
): Promise<Fornecedor | null> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("fornecedores")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Erro ao salvar fornecedor:", err);
    return null;
  }
}

export async function listContasGerenciais(): Promise<ContaGerencial[]> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("contas_gerenciais")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("❌ Erro ao listar contas gerenciais:", err);
    return [];
  }
}

export async function upsertContaGerencial(
  payload: Partial<ContaGerencial>,
): Promise<ContaGerencial | null> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("contas_gerenciais")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("❌ Erro ao salvar conta gerencial:", err);
    return null;
  }
}

export interface DespesaFilters {
  search?: string;
  status?: DespesaStatus | "all";
}

export async function listDespesas(
  filters: DespesaFilters = {},
): Promise<Despesa[]> {
  try {
    const client = ensureClient();
    let query = client
      .from("despesas")
      .select(
        "*, fornecedores(*), contas_gerenciais(*)",
        { count: "estimated" },
      )
      .order("data_vencimento", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      query = query.or(
        `descricao.ilike.${term},bank_account.ilike.${term}`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as Despesa[]) ?? [];
  } catch (err) {
    console.error("❌ Erro ao listar despesas:", err);
    return [];
  }
}

export async function upsertDespesa(
  payload: Partial<Despesa>,
): Promise<Despesa | null> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("despesas")
      .upsert(payload, { onConflict: "id" })
      .select(
        "*, fornecedores(*), contas_gerenciais(*)",
      )
      .single();

    if (error) throw error;
    return data as Despesa;
  } catch (err) {
    console.error("❌ Erro ao salvar despesa:", err);
    return null;
  }
}

export async function listBankTransactions(bankAccount?: string) {
  try {
    const client = ensureClient();
    let query = client
      .from("bank_transactions")
      .select("*")
      .order("date", { ascending: false })
      .limit(200);

    if (bankAccount) {
      query = query.eq("bank_account", bankAccount);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as BankTransaction[]) ?? [];
  } catch (err) {
    console.error("❌ Erro ao listar transações bancárias:", err);
    return [];
  }
}

export async function listExpensesForConciliation(): Promise<Despesa[]> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("despesas")
      .select("*, fornecedores(*), contas_gerenciais(*)")
      .eq("status", "Incurred")
      .eq("conciliated", false)
      .order("data_vencimento", { ascending: true });

    if (error) throw error;
    return (data as Despesa[]) ?? [];
  } catch (err) {
    console.error("❌ Erro ao buscar despesas para conciliação:", err);
    return [];
  }
}

export async function createConciliation(
  despesa: Despesa,
  transaction: BankTransaction,
  matchedBy = "manual",
  notes?: string,
): Promise<boolean> {
  try {
    const client = ensureClient();
    const difference = (despesa.valor ?? 0) - (transaction.amount ?? 0);

    const { error: conciliationError } = await client
      .from("conciliations")
      .insert({
        despesa_id: despesa.id,
        bank_transaction_id: transaction.id,
        matched_by: matchedBy,
        difference,
        notes,
      });

    if (conciliationError) throw conciliationError;

    const { error: updateError } = await client
      .from("despesas")
      .update({ status: "Paid", conciliated: true })
      .eq("id", despesa.id);

    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error("❌ Erro ao criar conciliação:", err);
    return false;
  }
}

export interface OverviewMetrics {
  total: number;
  pending: number;
  incurred: number;
  paid: number;
  conciliated: number;
  differences: number;
}

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  try {
    const client = ensureClient();
    const { data, error } = await client
      .from("despesas")
      .select("valor, status, conciliated")
      .limit(2000);

    if (error) throw error;

    const total = data?.reduce((acc, row) => acc + Number(row.valor || 0), 0) || 0;
    const pending = data?.filter((row) => row.status === "Pending").length || 0;
    const incurred = data?.filter((row) => row.status === "Incurred").length || 0;
    const paid = data?.filter((row) => row.status === "Paid").length || 0;
    const conciliated = data?.filter((row) => row.conciliated).length || 0;
    const differences = 0;

    return {
      total,
      pending,
      incurred,
      paid,
      conciliated,
      differences,
    };
  } catch (err) {
    console.error("❌ Erro ao calcular métricas de visão geral:", err);
    return {
      total: 0,
      pending: 0,
      incurred: 0,
      paid: 0,
      conciliated: 0,
      differences: 0,
    };
  }
}
