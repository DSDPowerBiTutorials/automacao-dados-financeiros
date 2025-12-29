# Estrutura de Financial Accounts para AR (Accounts Receivable)

## Situação Atual

### Tabela `financial_accounts` - Estrutura
```
Colunas (10):
- code (PK) - Código da conta (ex: "201.0", "201.1")
- name - Nome da conta (ex: "201.0 - COGS")
- type - Tipo da conta (expense, revenue, asset, liability)
- level - Nível hierárquico (1, 2, 3...)
- parent_code - Código da conta pai
- is_active - Conta ativa
- created_at - Data de criação
- updated_at - Data de atualização
- country_code - País (ES, US)
- applies_to_all_countries - Aplica a todos países
```

### Análise dos Dados Atuais

**Total de contas**: 40 registros

**Por tipo**:
- `expense`: 40 contas (100%)
- `revenue`: 0 contas ❌

**Por nível hierárquico**:
- Level 1: 12 contas (contas principais)
- Level 2: 26 contas (subcontas)
- Level 3: 2 contas (sub-subcontas)

**Range de códigos**:
- Início: `201.0` (COGS)
- Fim: `300.0` (FX Variation)

### Estrutura Hierárquica Atual
```
201.0 - COGS (Level 1)
  ├── 201.1 - COGS Growth (Level 2)
  ├── 201.2 - COGS Delight (Level 2)
  ├── 201.3 - COGS Planning Center (Level 2)
  ├── 201.4 - COGS LAB (Level 2)
  └── 201.5 - COGS Other Income (Level 2)

202.0 - Operating Expenses (Level 1)
  ├── 202.1 - OpEx Growth (Level 2)
  ├── 202.2 - OpEx Delight (Level 2)
  └── ...

300.0 - FX Variation (Level 1)
```

## Problema Identificado

❌ **Não existem contas de RECEITA** (`type = 'revenue'`)
- Todas as 40 contas são `type = 'expense'`
- Sistema foi parametrizado apenas para Accounts Payable (AP)
- **É necessário criar contas de receita para Accounts Receivable (AR)**

## Proposta de Estrutura para AR

### Plano de Contas de Receita (Revenue Chart)

Seguindo convenção contábil padrão:
- **Série 100**: Assets (Ativos)
- **Série 200**: Expenses (Despesas) ✅ **JÁ EXISTE**
- **Série 300**: Other (Outros/FX) ✅ **JÁ EXISTE**
- **Série 400**: Revenue (Receitas) ❌ **PRECISA CRIAR**

### Contas de Receita Sugeridas

#### Level 1 (Principais)
```
400.0 - Revenue (Receita Total)
410.0 - Operating Revenue (Receita Operacional)
420.0 - Non-Operating Revenue (Receita Não-Operacional)
430.0 - Financial Revenue (Receita Financeira)
440.0 - Deferred Revenue (Receita Diferida)
```

#### Level 2 (Detalhamento por produto/curso)
```
410.1 - Revenue - Growth Course
410.2 - Revenue - Delight Course
410.3 - Revenue - Planning Center
410.4 - Revenue - LAB
410.5 - Revenue - Other Courses

420.1 - Consulting Revenue
420.2 - Services Revenue
420.3 - Licensing Revenue

430.1 - Interest Income
430.2 - Foreign Exchange Gains
430.3 - Investment Income
```

### Estrutura Completa Proposta

```sql
-- Level 1: Main Revenue Categories
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('400.0', '400.0 - Total Revenue', 'revenue', 1, NULL, 'ES', true, true),
  ('410.0', '410.0 - Operating Revenue', 'revenue', 1, NULL, 'ES', true, true),
  ('420.0', '420.0 - Non-Operating Revenue', 'revenue', 1, NULL, 'ES', true, true),
  ('430.0', '430.0 - Financial Revenue', 'revenue', 1, NULL, 'ES', true, true);

-- Level 2: Operating Revenue by Course/Product
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('410.1', '410.1 - Revenue Growth Course', 'revenue', 2, '410.0', 'ES', true, true),
  ('410.2', '410.2 - Revenue Delight Course', 'revenue', 2, '410.0', 'ES', true, true),
  ('410.3', '410.3 - Revenue Planning Center', 'revenue', 2, '410.0', 'ES', true, true),
  ('410.4', '410.4 - Revenue LAB', 'revenue', 2, '410.0', 'ES', true, true),
  ('410.5', '410.5 - Revenue Other Courses', 'revenue', 2, '410.0', 'ES', true, true);

-- Level 2: Non-Operating Revenue
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('420.1', '420.1 - Consulting Revenue', 'revenue', 2, '420.0', 'ES', true, true),
  ('420.2', '420.2 - Services Revenue', 'revenue', 2, '420.0', 'ES', true, true),
  ('420.3', '420.3 - Licensing Revenue', 'revenue', 2, '420.0', 'ES', true, true);

-- Level 2: Financial Revenue
INSERT INTO financial_accounts (code, name, type, level, parent_code, country_code, applies_to_all_countries, is_active)
VALUES
  ('430.1', '430.1 - Interest Income', 'revenue', 2, '430.0', 'ES', true, true),
  ('430.2', '430.2 - Foreign Exchange Gains', 'revenue', 2, '430.0', 'ES', true, true),
  ('430.3', '430.3 - Investment Income', 'revenue', 2, '430.0', 'ES', true, true);
```

## Parametrização com CSV

### Opção 1: CSV com Hierarquia Completa
```csv
code,name,type,level,parent_code,country_code,applies_to_all_countries,is_active
400.0,400.0 - Total Revenue,revenue,1,,ES,true,true
410.0,410.0 - Operating Revenue,revenue,1,,ES,true,true
410.1,410.1 - Revenue Growth Course,revenue,2,410.0,ES,true,true
410.2,410.2 - Revenue Delight Course,revenue,2,410.0,ES,true,true
```

### Opção 2: CSV Simplificado (apenas Level 2 operacionais)
```csv
code,name,course_code
410.1,Revenue Growth Course,GROWTH
410.2,Revenue Delight Course,DELIGHT
410.3,Revenue Planning Center,PLANNING
410.4,Revenue LAB,LAB
410.5,Revenue Other Courses,OTHER
```

## Campos Necessários para CSV

### Campos Obrigatórios
1. `code` - Código da conta (único)
2. `name` - Nome da conta
3. `type` - Tipo (`revenue` para AR)

### Campos Recomendados
4. `level` - Nível hierárquico (1 ou 2)
5. `parent_code` - Conta pai (para Level 2)
6. `country_code` - País (ES, US)
7. `applies_to_all_countries` - true/false

### Campos Opcionais
8. `is_active` - true (padrão)
9. `created_at` - Auto-gerado
10. `updated_at` - Auto-gerado

## Recomendação

**Para começar o AR**, sugiro:

1. **Criar contas Level 1** (principais categorias)
   - 400.0 - Total Revenue
   - 410.0 - Operating Revenue
   - 420.0 - Non-Operating Revenue

2. **Criar contas Level 2** baseadas nos cursos/produtos que você já tem
   - Mapear de `course_code` para `financial_account_code`
   - Exemplo: curso "GROWTH" → conta "410.1 - Revenue Growth Course"

3. **Aguardar seu CSV** com:
   - Lista de produtos/serviços que geram receita
   - Estrutura hierárquica desejada
   - Códigos e nomes específicos do seu negócio

**Aguardando seu CSV para parametrizar!** 📊
