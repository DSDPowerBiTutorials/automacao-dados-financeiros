# Sistema Multi-País - Documentação

## 📋 Visão Geral

O sistema foi completamente reestruturado para suportar operações multi-país com três escopos:

- **🇪🇸 ES (Spain)** - Operações da Espanha em EUR
- **🇺🇸 US (United States)** - Operações dos Estados Unidos em USD  
- **🌐 GLOBAL** - Consolidado (Espanha + Estados Unidos)

## 🔄 Mudanças Implementadas

### 1. **Tipos e Configuração** (`src/lib/scope-utils.ts`)

#### Antes:
```typescript
export type ScopeType = "all" | "dsd" | "lh" | "dsd_lh";
```

#### Agora:
```typescript
export type ScopeType = "ES" | "US" | "GLOBAL";

export const SCOPE_CONFIG: Record<ScopeType, ScopeConfig> = {
  ES: {
    label: "Spain",
    icon: "🇪🇸",
    color: "red",
    countryCode: "ES",
    currency: "EUR",
    description: "Spain Operations"
  },
  US: {
    label: "United States",
    icon: "🇺🇸",
    color: "blue",
    countryCode: "US",
    currency: "USD",
    description: "United States Operations"
  },
  GLOBAL: {
    label: "Global",
    icon: "🌐",
    color: "purple",
    countryCode: "GLOBAL",
    currency: "EUR",
    description: "Consolidated (Spain + US)"
  }
};
```

### 2. **Seletor de Scope** (`src/components/app/scope-selector.tsx`)

Agora mostra as bandeiras e nomes corretos:
- 🇪🇸 Spain
- 🇺🇸 United States
- 🌐 Global

### 3. **Estrutura de Banco de Dados**

#### Tabela `invoices` com Constraints:

```sql
CREATE TABLE public.invoices (
  -- ... outros campos ...
  country_code TEXT NOT NULL CHECK (country_code IN ('ES', 'US', 'GLOBAL')),
  scope TEXT NOT NULL CHECK (scope IN ('ES', 'US', 'GLOBAL')),
  applies_to_all_countries BOOLEAN DEFAULT FALSE,
  -- ...
);
```

**Campos importantes:**
- `scope`: Define o país/escopo ('ES', 'US', 'GLOBAL')
- `country_code`: Código do país (mesmo valor que scope)
- `applies_to_all_countries`: TRUE quando scope = 'GLOBAL'
- `currency`: Moeda padrão (EUR para ES/GLOBAL, USD para US)

### 4. **Funções Utilitárias**

#### `scopeToFields(scope: ScopeType)`
Converte scope para campos do banco:
```typescript
scopeToFields("ES")     → { country_code: "ES", scope: "ES", applies_to_all_countries: false }
scopeToFields("US")     → { country_code: "US", scope: "US", applies_to_all_countries: false }
scopeToFields("GLOBAL") → { country_code: "GLOBAL", scope: "GLOBAL", applies_to_all_countries: true }
```

#### `getRecordScope(record)`
Identifica o scope de um registro baseado em seus campos.

#### `matchesScope(record, targetScopes)`
Verifica se um registro corresponde aos scopes selecionados. Suporta Set para filtros múltiplos.

## 🚀 Como Usar

### Criando uma Invoice

```typescript
const invoice = {
  invoice_date: "2024-12-26",
  scope: "ES",                    // ou "US" ou "GLOBAL"
  country_code: "ES",
  applies_to_all_countries: false, // true se scope = "GLOBAL"
  currency: "EUR",                 // "USD" se scope = "US"
  // ... outros campos
};
```

### Filtrando por Scope

```typescript
// Múltiplos scopes
const selectedScopes = new Set<ScopeType>(["ES", "US"]);

// Filtrar invoices
const filtered = invoices.filter(inv => 
  matchesScope(inv, selectedScopes)
);
```

## 📝 Scripts SQL

### 1. **Criar Tabela Nova** (`docs/create-invoices-table.sql`)
- Cria a tabela `invoices` do zero
- Inclui constraints, índices, triggers
- Configura RLS (Row Level Security)

### 2. **Migrar Sistema Antigo** (`docs/migrate-to-multi-country.sql`)
- Converte dados antigos (dsd/lh/all) para novo formato (ES/US/GLOBAL)
- Atualiza constraints
- Mantém dados existentes

**Para executar no Supabase:**
1. Acesse SQL Editor no Supabase Dashboard
2. Execute primeiro `create-invoices-table.sql` (se tabela não existe)
3. Ou execute `migrate-to-multi-country.sql` (se já existe com dados antigos)

## 🎨 Interface do Usuário

### Formulário de Invoice

O campo **Scope** agora mostra:
```
┌─────────────────────────┐
│ 🇪🇸 Spain              │
│ 🇺🇸 United States      │
│ 🌐 Global              │
└─────────────────────────┘
```

### Filtros

Scope View permite selecionar múltiplos países:
- 🇪🇸 Spain
- 🇺🇸 United States  
- 🌐 Global

### Tabela de Invoices

Coluna **Scope** mostra a bandeira correspondente:
- 🇪🇸 para registros ES
- 🇺🇸 para registros US
- 🌐 para registros GLOBAL

## ⚠️ Importantes

### Regras de Negócio

1. **Scope GLOBAL:**
   - Representa consolidação de ES + US
   - `applies_to_all_countries = true`
   - Aparece em filtros de ES e US

2. **Moeda Padrão:**
   - ES → EUR
   - US → USD
   - GLOBAL → EUR (moeda base)

3. **Compatibilidade:**
   - Sistema antigo (dsd/lh) migrado automaticamente
   - Novos registros devem usar ES/US/GLOBAL

### Validação

O banco de dados garante que:
- `scope` só aceita: 'ES', 'US', 'GLOBAL'
- `country_code` só aceita: 'ES', 'US', 'GLOBAL'
- Valores são consistentes entre si

## 🔧 Manutenção

### Adicionar Novo País

1. Atualizar `ScopeType` em `scope-utils.ts`:
   ```typescript
   export type ScopeType = "ES" | "US" | "GLOBAL" | "BR";
   ```

2. Adicionar configuração:
   ```typescript
   BR: {
     label: "Brazil",
     icon: "🇧🇷",
     color: "green",
     countryCode: "BR",
     currency: "BRL",
     description: "Brazil Operations"
   }
   ```

3. Atualizar constraints SQL:
   ```sql
   CHECK (scope IN ('ES', 'US', 'GLOBAL', 'BR'))
   ```

4. Adicionar no ScopeSelector

## 📊 Relatórios

### Filtrar por País
```typescript
// Apenas Espanha
invoices.filter(inv => inv.scope === "ES")

// Espanha e Global
invoices.filter(inv => ["ES", "GLOBAL"].includes(inv.scope))

// Todos os países
invoices.filter(inv => matchesScope(inv, new Set(["ES", "US", "GLOBAL"])))
```

### Consolidação
```typescript
// Registros que afetam múltiplos países
const globalRecords = invoices.filter(inv => 
  inv.applies_to_all_countries === true
);
```

---

**Última atualização:** 26 de dezembro de 2024  
**Sistema:** DSD Finance Hub Multi-Country
