Perfeito ⚙️
O que você quer aqui é um **documento de instruções personalizadas profissional e balanceado** para o **Codex** (ou qualquer assistente IA com acesso ao seu repositório),
que una o **rigor técnico** do primeiro texto com a **clareza operacional** do segundo —
mas sem detalhes desnecessários (como o tratamento de `.xlsx`) e **com foco absoluto em segurança, incrementalismo e consistência de código**.

Abaixo está a **versão final revisada e consolidada**, pronta para uso em “Instruções Personalizadas” no Codex.

---


# 🧩 Diretrizes Técnicas — Projeto `automacao-dados-financeiros`

## 🏗️ Contexto Geral do Projeto

O repositório `automacao-dados-financeiros` é um sistema de **gestão e conciliação financeira automatizada**, desenvolvido em **Next.js + TypeScript**, com **Supabase (Postgres)** como banco de dados e armazenamento de arquivos.
O sistema é hospedado na **Vercel**, com **deploy automatizado** a partir da branch `main`.

O objetivo do sistema é processar lançamentos bancários (como **Bankinter EUR/USD**) e realizar a **conciliação automática** com origens de pagamento como **Braintree**, **Stripe** e **GoCardless**, garantindo integridade contábil e rastreabilidade total das operações.

---

## ⚙️ Stack Técnica e Padrões de Arquitetura

**Front-end:**

* Next.js (App Router)
* React 18
* Tailwind CSS
* shadcn/ui (componentes)
* Lucide-react (ícones)

**Back-end:**

* Supabase (Auth, Storage e Tables)
* API Routes (Next.js `/api`)
* Tipagem rigorosa com TypeScript (`*.d.ts` e interfaces compartilhadas)

**Banco de dados:**

* Tabela `csv_rows` (dados processados e conciliados)
* Bucket `csv_files` (arquivos CSV enviados)

**Rotas padrão:**

* `/reports/{source}` → exemplo: `/reports/bankinter-eur`, `/reports/braintree-eur`

---

## 🧠 Padrões e Boas Práticas Obrigatórias

Antes de editar qualquer arquivo:

1. **Analise a estrutura existente** e identifique dependências entre componentes, hooks, páginas e funções auxiliares (`@/lib/`).
2. **Preserve todos os imports, interfaces, nomes de variáveis e funções.**
3. **Respeite o padrão Prettier + ESLint** definido no projeto.
4. **Não altere ou remova** trechos fora do escopo solicitado.

   * Caso uma refatoração seja necessária, **avise e explique antes de aplicar**.
5. Se adicionar funções, **documente com comentários curtos e objetivos** (entrada, saída e propósito).
6. Utilize sempre `async/await` com `try/catch` e logs descritivos de erro.
7. **Não modifique o cliente Supabase (`@/lib/supabase`)** nem suas variáveis de ambiente.

---

## 💾 Upload e Integração com Supabase

### 📥 Entrada:

* Aceite **apenas arquivos `.csv`** (arquivos `.xlsx` devem ser convertidos automaticamente em `.csv` antes de processar).
* Cada upload deve gerar um arquivo `.csv` salvo no **bucket `csv_files`** e linhas inseridas na tabela `csv_rows`.

### 🧭 Mapeamento de colunas:

| Coluna original | Campo destino | Observações                               |
| --------------- | ------------- | ----------------------------------------- |
| **FECHA VALOR** | `date`        | Converter para formato ISO (`YYYY-MM-DD`) |
| **DESCRIPCIÓN** | `description` | Remover aspas e espaços extras            |
| **HABER**       | `amount`      | Valor positivo                            |
| **DEBE**        | `amount`      | Valor negativo (deve ser subtraído)       |

**Fórmula:**
`amount = (parseFloat(haber) || 0) - (parseFloat(debe) || 0)`

### ⚙️ Armazenamento:

Cada linha inserida no Supabase deve conter:

```json
{
  "id": "BANKINTER-EUR-{timestamp}",
  "file_name": "bankinter-eur.csv",
  "source": "bankinter-eur",
  "date": "2025-12-02",
  "description": "Pago recibido de Braintree",
  "amount": 1240.50,
  "category": "Other",
  "classification": "Other",
  "reconciled": false,
  "custom_data": {
    "conciliado": false,
    "paymentSource": null,
    "reconciliationType": null
  }
}
```

### 🧱 Regras:

* Todos os uploads devem ser processados com feedback visual ao usuário (alerta ou toast).
* Se o upload falhar, mostrar mensagem clara e logar o erro no console.
* Ao salvar, use o endpoint `/api/csv-rows` (métodos POST e PUT).
* Antes de inserir, validar formato e conteúdo.

---

## 🔁 Conciliação Automática (Reconciliation Logic)

### 📊 Lógica:

1. Compare datas entre Bankinter e Braintree dentro de um intervalo de ±3 dias.
2. Compare valores absolutos:
   `Math.abs(bankinter.amount - braintree.amount) < 0.01`
3. Se houver correspondência:

   ```ts
   conciliado = true
   reconciliationType = "automatic"
   paymentSource = origemEncontrada
   ```
4. Se não houver:

   ```ts
   conciliado = false
   reconciliationType = null
   ```
5. Mantenha funções auxiliares:

   * `isWithinDateRange()`
   * `reconcilePaymentSources()`
   * `applyFilters()`

### 🧩 Regras adicionais:

* O processo de conciliação deve ser **idempotente** (reexecutável sem duplicar registros).
* Em caso de split manual, preservar a relação original (`splitFrom`, `splitIndex`).

---

## 🧾 Estrutura e Modularidade

* Preserve as interfaces:

  * `BankinterEURRow`
  * `PaymentSourceRow`
  * `ReconciliationResult`
* Mantenha a estrutura React organizada:

  * UI: `/components/ui`
  * Hooks: `/hooks`
  * Utilitários: `/lib`
  * Páginas: `/app/reports/{source}`
* Evite lógica inline pesada; mova funções auxiliares para `/lib/utils.ts` quando apropriado.
* Mantenha consistência nos estilos com Tailwind (`text-gray-700`, `bg-gray-50`, `border-gray-200`).

---

## 🧱 Commits, Branches e PRs

### 💬 Padrão de commits:

| Tipo        | Uso                                          |
| ----------- | -------------------------------------------- |
| `feat:`     | Nova funcionalidade                          |
| `fix:`      | Correção de bug                              |
| `refactor:` | Melhoria de código sem alterar comportamento |
| `chore:`    | Ajustes internos (lint, build, deps)         |

### 📦 Padrão de branch:

`codex/{feature}` → exemplo:
`codex/fix-bankinter-upload`
`codex/feat-auto-reconciliation`

### 🚦 Workflow:

1. O Codex deve sempre criar uma **branch isolada**.
2. Exibir **diff detalhado** antes do commit.
3. Solicitar confirmação antes de abrir o PR.
4. Se a mudança for extensa (>50 linhas), **pedir validação explícita** do usuário.

---

## 🧪 Testes e Validação

Antes de criar o PR:

1. Execute `npm run build` para garantir que não há erros.
2. Valide tipagem TypeScript (`tsc --noEmit`).
3. Se possível, rode `npm run lint`.
4. Verifique se a lógica de upload e reconciliação segue o padrão esperado.
5. Confirme que nenhuma alteração visual (UI/UX) foi afetada indevidamente.

---

## 📜 Logs e Mensagens

* Prefira mensagens curtas e contextuais:

  ```ts
  console.log(`✅ Upload concluído: ${fileName} (${rowCount} registros)`)
  console.error("❌ Erro ao salvar no Supabase:", error)
  ```
* No front-end, use `Alert` ou `Toast` para feedback de sucesso/erro.
* Evite logs excessivos no ambiente de produção.

---

## 🔒 Segurança e Privacidade

* **Nunca exponha chaves do Supabase** (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
* Todas as variáveis de ambiente estão configuradas via **Vercel**, não localmente.
* Nunca crie ou edite arquivos `.env.local`.
* Nunca acesse dados do Supabase fora do client (`@/lib/supabase`).

---

## 🚀 Contexto de Deploy e Execução

* O deploy ocorre automaticamente via **Vercel** após merge na branch `main`.
* As variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) são configuradas apenas no painel da Vercel.
* Não rodar o app localmente nem depender de `.env.local`.
* Após merge, confirmar:

  * `/reports/bankinter-eur` renderiza corretamente.
  * Uploads funcionam e aparecem na tabela `csv_rows`.

---

## 🧠 Objetivo Final

O foco do Codex é **evoluir o projeto de forma incremental e segura**, garantindo:

* **Confiabilidade** da conciliação automática e manual.
* **Integridade** dos dados no Supabase.
* **Manutenção do layout e UX** originais.
* **Ausência de regressões** em funcionalidades existentes.

Toda alteração deve estar **diretamente relacionada ao escopo solicitado**, sem comprometer o restante do sistema.

---

## ✅ Resumo Operacional

| Área          | Deve fazer                                    | Não deve fazer                          |
| ------------- | --------------------------------------------- | --------------------------------------- |
| Uploads       | Converter e salvar CSV no Supabase            | Editar funções fora do escopo           |
| Reconciliação | Manter lógica ±3 dias e comparação de valores | Alterar comportamento original          |
| Front-end     | Preservar estilos e componentes               | Mudar layout sem aprovação              |
| Commits       | Incrementais, descritivos e revisáveis        | Commits genéricos ou múltiplos em batch |
| Configuração  | Usar env da Vercel                            | Criar `.env.local`                      |

---

Quer que eu te gere agora a **versão bilíngue (PT + EN técnico)** desse documento para colar direto nas instruções do Codex e usá-lo como “guia de engenharia oficial” do repositório?
