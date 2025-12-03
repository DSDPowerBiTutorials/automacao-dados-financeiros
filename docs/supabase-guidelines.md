````md
# 🧾 Supabase Data Handling & Upload Guidelines  
**DSD Finance Hub — Automação de Dados Financeiros**

---

## 🧩 Contexto do projeto
Este documento define os padrões de integração entre o front-end (Next.js + Tailwind) e o banco de dados Supabase,
garantindo ingestão de dados validada, segura e padronizada para todos os relatórios (Bankinter, Braintree, etc).

---

## ⚙️ Stack técnica
- Front-end: Next.js (App Router) + React 18 + TailwindCSS + shadcn/ui  
- Back-end: Supabase (PostgreSQL + Storage + Auth)  
- Deploy: Vercel (CI/CD automatizado)  
- Automação: Codex (OpenAI)  

---

## 🧱 Estrutura da tabela `csv_rows`

| Campo | Tipo | Descrição |
|--------|------|-----------|
| id | text | Identificador único |
| file_name | text | Nome original do arquivo |
| source | text | Origem (`bankinter-eur`, `braintree-usd`, etc.) |
| date | text | Data ISO (`YYYY-MM-DD`) |
| description | text | Descrição detalhada da transação |
| amount | numeric | Valor numérico |
| category | text | Categoria da transação |
| classification | text | Classificação (Receita, Despesa) |
| deposit_account | text | Conta de origem ou destino |
| payment_method | text | Método de pagamento |
| order_numbers | text[] | Lista de pedidos associados |
| reconciled | boolean | Se está conciliado |
| matched_with | text | Referência cruzada de conciliação |
| custom_data | jsonb | Metadados adicionais |
| created_at | timestamptz | Criado automaticamente |
| updated_at | timestamptz | Atualizado automaticamente |

---

## 🧩 Operações CRUD em Supabase

### 🔍 Ler linhas (SELECT)
```ts
let { data: csv_rows, error } = await supabase
  .from('csv_rows')
  .select('*')
````

### 🔎 Ler colunas específicas

```ts
let { data: csv_rows, error } = await supabase
  .from('csv_rows')
  .select('date,description,amount')
```

### 🔢 Paginar resultados

```ts
let { data: csv_rows, error } = await supabase
  .from('csv_rows')
  .select('*')
  .range(0, 9)
```

---

### ➕ Inserir linhas

```ts
const { data, error } = await supabase
  .from('csv_rows')
  .insert([
    { date: '2025-12-03', description: 'Trans/Stripe', amount: 2475.86 }
  ])
  .select()
```

### 🔁 Upsert (inserir ou atualizar)

```ts
const { data, error } = await supabase
  .from('csv_rows')
  .upsert({ date: '2025-12-03', description: 'Trans/PayPal', amount: 1380.01 })
  .select()
```

---

### ✏️ Atualizar linhas

```ts
const { data, error } = await supabase
  .from('csv_rows')
  .update({ reconciled: true })
  .eq('id', 'BANKINTER-EUR-20251203')
  .select()
```

---

### ❌ Deletar linhas

```ts
const { error } = await supabase
  .from('csv_rows')
  .delete()
  .eq('source', 'bankinter-eur')
```

---

## 🧩 Realtime (Inscrições em mudanças)

### Inserções

```ts
const channel = supabase.channel('insert-channel')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'csv_rows' }, payload => {
    console.log('Nova linha adicionada:', payload)
  })
  .subscribe()
```

### Atualizações

```ts
const channel = supabase.channel('update-channel')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'csv_rows' }, payload => {
    console.log('Linha atualizada:', payload)
  })
  .subscribe()
```

### Exclusões

```ts
const channel = supabase.channel('delete-channel')
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'csv_rows' }, payload => {
    console.log('Linha deletada:', payload)
  })
  .subscribe()
```

---

## 📤 Uploads: CSV e XLSX

* Tipos aceitos: `.csv` e `.xlsx`
* `.xlsx` deve ser convertido internamente para `.csv`
* Cabeçalho obrigatório (linha 1)
* Encoding: UTF-8 sem BOM
* Separador: vírgula (`,`)

### Colunas obrigatórias:

* `date`
* `description`
* `amount`
* `source`

### Formatos esperados:

| Campo       | Exemplo               | Observações             |
| ----------- | --------------------- | ----------------------- |
| date        | `2025-11-20`          | formato ISO             |
| description | `Trans/PayPal Europe` | texto limpo             |
| amount      | `2475.86`             | sem separador de milhar |
| source      | `bankinter-eur`       | origem padrão           |

---

## 🧠 Autoaprendizado do Codex

O Codex deve:

1. Validar todos os uploads `.csv` e `.xlsx` antes de enviar ao Supabase.
2. Detectar erros de schema (falta de header, tipo errado, etc).
3. Registrar o erro em `/logs/upload_errors.log`.
4. Atualizar automaticamente este documento com as correções descobertas.
5. Commitar mudanças com:

   ```bash
   git add docs/supabase-guidelines.md logs/upload_errors.log
   git commit -m "chore: auto-update Supabase data guidelines after upload error"
   git push origin main
   ```

---

## 🚀 Regras globais

* Nenhum upload é descartado: todo erro deve ser tratado e corrigido automaticamente.
* Todos os botões de upload aceitam `.csv` e `.xlsx`.
* O Codex deve sempre se referir a este arquivo antes de alterar código Supabase.
* Logs de erro e aprendizado incremental devem ser armazenados em `/logs`.

---

## ✅ Commit e Deploy automáticos

```bash
git add docs/supabase-guidelines.md
git commit -m "docs: add Supabase data handling and upload guidelines"
git push origin main
```

---

## 🧾 Última revisão

**Data:** 2025-12-03
**Responsável:** DSD Data Engineering
**Contato:** [data@dsdgroup.es](mailto:data@dsdgroup.es)

```
```
