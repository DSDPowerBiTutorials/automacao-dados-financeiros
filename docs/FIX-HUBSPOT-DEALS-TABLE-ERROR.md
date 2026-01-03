# Fix: Erro "Invalid object name 'deals'" na Sincronização HubSpot

**Data**: 2026-01-03  
**Prioridade**: 🚨 ALTA  
**Status**: 🔧 EM CORREÇÃO

## Problema

Ao tentar sincronizar dados do HubSpot na página `/hubspot/settings`, aparece o erro:

```
"Erro ao sincronizar: Invalid object name 'deals'."
```

## Root Cause

O código em [src/app/api/hubspot/sync/route.ts](src/app/api/hubspot/sync/route.ts) está tentando fazer um `SELECT FROM deals`, mas essa tabela **não existe** no SQL Server Data Warehouse.

```typescript
// ❌ ERRO: Tabela 'deals' não existe
const result = await pool.request().query(`
  SELECT TOP 1000
    deal_id,
    deal_name,
    amount,
    close_date,
    stage,
    pipeline,
    owner_name,
    company_name
  FROM deals  // <-- TABELA NÃO ENCONTRADA
  WHERE close_date >= DATEADD(month, -6, GETDATE())
  ORDER BY close_date DESC
`);
```

## Solução Implementada

### 1. Criar API para Verificar Tabelas Disponíveis

Criado endpoint `/api/hubspot/tables` que lista todas as tabelas e colunas do SQL Server:

- **Arquivo**: [src/app/api/hubspot/tables/route.ts](src/app/api/hubspot/tables/route.ts)
- **Método**: GET
- **Retorna**: Lista de todas as tabelas com suas colunas

### 2. Adicionar Botão "Ver Tabelas" na UI

Adicionado na página `/hubspot/settings`:

- Botão "Ver Tabelas" para verificar tabelas disponíveis
- Botão "Sincronizar Dados" melhorado com tratamento de erro
- Logs no console do browser com detalhes das tabelas

## Como Usar

### Passo 1: Verificar Tabelas Disponíveis

1. Acesse: `/hubspot/settings`
2. Clique em **"Ver Tabelas"**
3. Abra o **Console do Browser** (F12 → Console)
4. Veja a lista completa de tabelas e colunas

### Passo 2: Identificar a Tabela Correta

No console, você verá algo como:

```json
{
  "success": true,
  "count": 15,
  "tables": [
    {
      "schema": "dbo",
      "name": "HubSpot_Deals",  // <-- NOME CORRETO!
      "columns": [
        { "COLUMN_NAME": "deal_id", "DATA_TYPE": "varchar" },
        { "COLUMN_NAME": "deal_name", "DATA_TYPE": "varchar" },
        { "COLUMN_NAME": "amount", "DATA_TYPE": "decimal" }
      ]
    }
  ]
}
```

### Passo 3: Atualizar o Código de Sincronização

Edite [src/app/api/hubspot/sync/route.ts](src/app/api/hubspot/sync/route.ts) e substitua `deals` pelo nome correto:

```typescript
// ✅ CORRETO: Use o nome real da tabela
const result = await pool.request().query(`
  SELECT TOP 1000
    deal_id,
    deal_name,
    amount,
    close_date,
    stage,
    pipeline,
    owner_name,
    company_name
  FROM HubSpot_Deals  // <-- NOME CORRETO DA TABELA
  WHERE close_date >= DATEADD(month, -6, GETDATE())
  ORDER BY close_date DESC
`);
```

### Passo 4: Ajustar Nomes de Colunas

As colunas também podem ter nomes diferentes. Por exemplo:

```typescript
// Se a coluna for "DealID" em vez de "deal_id"
SELECT 
  DealID as deal_id,
  DealName as deal_name,
  Amount as amount,
  CloseDate as close_date
FROM HubSpot_Deals
```

## Tabelas Comuns do HubSpot

Nomes possíveis no Data Warehouse:

- `HubSpot_Deals`
- `hubspot_deals`
- `hs_deals`
- `CRM_Deals`
- `Deals` (com esquema específico, ex: `hubspot.Deals`)
- `vw_hubspot_deals` (view)

## Arquivos Criados/Modificados

### Novos Arquivos

- [src/app/api/hubspot/tables/route.ts](src/app/api/hubspot/tables/route.ts) — API para listar tabelas

### Arquivos Modificados

- [src/app/hubspot/settings/page.tsx](src/app/hubspot/settings/page.tsx)
  - Adicionada função `syncHubSpotData()`
  - Adicionada função `checkAvailableTables()`
  - Botões "Sincronizar Dados" e "Ver Tabelas"

## Próximos Passos

1. **Identificar tabela correta** → Use o botão "Ver Tabelas"
2. **Atualizar query SQL** → Edite `/api/hubspot/sync/route.ts`
3. **Testar sincronização** → Use o botão "Sincronizar Dados"
4. **Verificar dados** → Acesse `/hubspot/pipeline` para ver os deals

## Comandos SQL Úteis

### Listar todas as tabelas
```sql
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME
```

### Ver colunas de uma tabela específica
```sql
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'nome_da_tabela'
ORDER BY ORDINAL_POSITION
```

### Verificar se existe uma tabela com "deal" no nome
```sql
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%deal%'
```

## Prevenção Futura

Ao integrar com novos Data Warehouses:

1. **Sempre verificar tabelas disponíveis primeiro**
2. **Não assumir nomes de tabelas**
3. **Usar a API `/api/hubspot/tables` para discovery**
4. **Documentar schema real no README**

## Contato com DBA/Administrador

Se não conseguir identificar a tabela:

1. Entre em contato com o administrador do Data Warehouse
2. Pergunte: "Qual a tabela que contém os deals do HubSpot?"
3. Solicite: Schema completo (nomes de tabelas e colunas)
4. Verifique: Se há views ou stored procedures disponíveis

---

**Autor**: GitHub Copilot  
**Revisor**: Jorge Marfetan
