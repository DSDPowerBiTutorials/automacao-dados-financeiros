# Análise: Estrutura de Contas a Receber

## Situação Atual

### Tabela `invoices` (Unificada)
A tabela `invoices` serve tanto para **Contas a Pagar (AP)** quanto **Contas a Receber (AR)**.

**Campo Discriminador**: `invoice_type`
- `INCURRED` = Despesa (Contas a Pagar)
- Outros valores (a definir) = Receita (Contas a Receber)

### Campos Disponíveis (49 colunas)

#### Datas (7 campos)
- `input_date` - Data de entrada no sistema
- `invoice_date` - Data da fatura
- `benefit_date` - Data do benefício/competência
- `due_date` - Data de vencimento
- `schedule_date` - Data agendada para pagamento/recebimento
- `payment_date` - Data efetiva de pagamento/recebimento
- `created_at`, `updated_at` - Auditoria

#### Identificação (5 campos)
- `id` - PK
- `invoice_number` - Número da fatura
- `invoice_type` - Tipo (INCURRED, REVENUE, etc.)
- `entry_type` - Tipo de lançamento
- `description` - Descrição

#### Valores Financeiros (3 campos)
- `invoice_amount` - Valor da fatura
- `currency` - Moeda (EUR, USD, etc.)
- `eur_exchange` - Taxa de câmbio para EUR

#### Entidades Relacionadas (7 campos)
- `provider_code` - Fornecedor (para AP) / **Cliente (para AR - reusar)**
- `bank_account_code` - Conta bancária
- `financial_account_code` - Conta contábil
- `financial_account_name` - Nome da conta contábil
- `course_code` - Código do curso (DSD específico)
- `payment_method_code` - Método de pagamento
- `cost_center_code` - Centro de custo

#### Categorização de Custos (2 campos)
- `cost_type_code` - Tipo de custo
- `dep_cost_type_code` - Tipo de custo departamental

#### Escopo e Geográfico (3 campos)
- `country_code` - Código do país (ES, US)
- `scope` - Escopo (ES, US, GLOBAL)
- `applies_to_all_countries` - Aplica a todos países

#### Impactos Contábeis (2 campos)
- `dre_impact` - Impacto no DRE (Demonstração de Resultados)
- `cash_impact` - Impacto no fluxo de caixa

#### Status e Controle (4 campos)
- `is_reconciled` - Reconciliado
- `payment_status` - Status de pagamento
- `is_intercompany` - Transação intercompany
- `notes` - Observações

#### Split Invoice (5 campos)
- `is_split` - É invoice dividida
- `parent_invoice_id` - ID da invoice pai
- `split_number` - Número da divisão
- `total_splits` - Total de divisões
- `split_type` - Tipo de divisão

## Gaps Identificados

### 1. Tabela `customers` não existe
**Solução proposta:**
- Criar tabela `customers` similar a `providers`
- Campos: `code`, `name`, `tax_id`, `email`, `phone`, `address`, `city`, `country`, `payment_terms`, `is_active`
- Ou reusar `provider_code` de forma genérica renomeando para `entity_code`

### 2. Valores de `invoice_type` para AR não definidos
**Proposta:**
- `INCURRED` = Despesa (AP)
- `REVENUE` = Receita (AR)
- `DEFERRED_REVENUE` = Receita diferida
- `ACCRUED_REVENUE` = Receita acumulada

### 3. Campo `customer_code` não existe
**Solução:**
- Adicionar coluna `customer_code` na tabela `invoices`
- Ou usar `provider_code` de forma genérica (cliente é tipo de entidade)

### 4. Campos específicos de AR que podem faltar
- `payment_terms` - Prazo de pagamento do cliente (pode vir de customers)
- `discount_amount` - Desconto concedido
- `discount_percentage` - Percentual de desconto
- `tax_amount` - Valor de impostos
- `net_amount` - Valor líquido

## Proposta de Implementação

### Fase 1: Criar módulo AR usando estrutura atual
1. Criar página de invoices de receita
2. Filtrar por `invoice_type = 'REVENUE'`
3. Usar `provider_code` temporariamente como `customer_code`
4. Criar formulário de input de receitas

### Fase 2: Adicionar tabela customers
```sql
CREATE TABLE customers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  currency TEXT DEFAULT 'EUR',
  payment_terms TEXT DEFAULT 'net_30',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Fase 3: Adicionar coluna customer_code
```sql
ALTER TABLE invoices 
ADD COLUMN customer_code TEXT REFERENCES customers(code);

CREATE INDEX idx_invoices_customer ON invoices(customer_code);
```

### Fase 4: Migrar dados se necessário
- Se já existem receitas usando `provider_code`, migrar para `customer_code`

## Campos Relevantes para AR

### Essenciais para Dashboard AR
- `invoice_date` - Data da fatura
- `due_date` - Data de vencimento **[CRÍTICO para aging]**
- `payment_date` - Data de recebimento
- `invoice_amount` - Valor
- `customer_code` / `provider_code` - Cliente
- `is_reconciled` - Recebido?
- `currency` - Moeda

### Para Fluxo de Caixa AR
- `schedule_date` - Previsão de recebimento
- `cash_impact` - Impacta caixa
- `bank_account_code` - Conta que receberá

### Para Análise
- `benefit_date` - Competência
- `scope` - ES/US/GLOBAL
- `course_code` - Curso (receita por produto)
- `is_intercompany` - Receita intercompany

## Recomendação Final

**Opção A (Rápida):** Usar estrutura atual
- Criar tipo `REVENUE` em `invoice_type`
- Usar `provider_code` como cliente temporariamente
- Implementar dashboard AR com filtro `WHERE invoice_type = 'REVENUE'`

**Opção B (Ideal):** Criar estrutura completa
- Criar tabela `customers`
- Adicionar coluna `customer_code` em `invoices`
- Adicionar campos específicos de AR (discount, tax, net_amount)
- Implementar com relacionamentos corretos

**Sugestão:** Começar com Opção A, planejar migração para Opção B.
