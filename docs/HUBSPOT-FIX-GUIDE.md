# 🔧 GUIA: Como Resolver o Problema dos Dados do HubSpot

## ❌ PROBLEMA IDENTIFICADO

Os dados antigos do HubSpot no Supabase foram sincronizados com a **query antiga** (antes das correções). Mesmo após o deploy das correções, os dados continuam os mesmos porque:

1. Deploy foi feito ✅
2. Código está correto ✅  
3. MAS os dados no Supabase são antigos ❌

## ✅ SOLUÇÃO: 3 Passos

### 1️⃣ Deletar Dados Antigos do Supabase

Execute este SQL no **Supabase SQL Editor**:

```sql
-- Deletar TODOS os dados do HubSpot
DELETE FROM csv_rows WHERE source = 'hubspot';

-- Verificar que foi deletado (deve retornar 0)
SELECT COUNT(*) as total FROM csv_rows WHERE source = 'hubspot';
```

**Onde executar:**
1. Abra [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (barra lateral esquerda)
4. Cole o SQL acima e clique em **Run**

---

### 2️⃣ Fazer Novo Sync

Na aplicação:
1. Vá para a página **HubSpot Deals**: `/reports/hubspot`
2. Clique no botão **"Sync from HubSpot"**
3. Aguarde o sync completar (pode demorar 30-60 segundos)

Isso vai buscar os dados com a **query correta** que agora inclui:
- ✅ `ip__ecomm_bridge__order_number` (order code correto)
- ✅ `website_order_id` (web order ID)
- ✅ `product_quantity` (quantidade correta)

---

### 3️⃣ Verificar os Resultados

Após o sync, a order do Ahmed Hamada deve mostrar:

| Campo | Antes (Errado) | Depois (Correto) |
|-------|----------------|------------------|
| **Order** | `dsd r1` | `e437d54` ✅ |
| **Reference** | `#DSDESDSD R1` | `#DSDESE437D54-24819` ✅ |
| **Web Order ID** | `-` | `2831851` ✅ |
| **Quantity** | `0` | `2` ✅ |

---

## 🚨 IMPORTANTE: Se Ainda Não Funcionar

Se após fazer os 3 passos acima os dados **ainda estiverem errados**, pode ser que:

### Cenário A: Campos Vazios no HubSpot
Os campos `ip__ecomm_bridge__order_number` e `website_order_id` podem estar **vazios** no SQL Server do HubSpot para essa order específica.

**Como verificar:**
Execute na aplicação e veja os logs do console do navegador (F12 > Console) durante o sync.

**Solução:**
Esses campos precisam ser preenchidos no HubSpot primeiro. Fale com quem gerencia o HubSpot para verificar se essas orders têm os campos ecommerce preenchidos.

---

### Cenário B: Fallback para Query Simples
Se a query enriquecida falhar, o sistema cai para a query simples que **não tem** esses campos.

**Como verificar:**
Olhe os logs do console durante o sync. Se aparecer:
```
⚠️ Query enriquecida falhou, tentando query simples...
```

Então a query enriquecida está falhando.

**Solução:**
Execute este teste SQL direto no SQL Server do HubSpot:
```sql
SELECT TOP 1
  d.ip__ecomm_bridge__order_number,
  d.website_order_id,
  d.dealname
FROM Deal d
WHERE d.DealId = 12037674126
```

Se retornar erro, os campos não existem ou têm nome diferente.

---

## 📊 Campos Confirmados que Existem

| Campo | Existe? | Localização |
|-------|---------|-------------|
| `ip__ecomm_bridge__order_number` | ✅ | Tabela Deal |
| `website_order_id` | ✅ | Tabela Deal |
| `product_quantity` | ✅ | Tabela LineItem |
| `product_amount` | ✅ | Tabela LineItem |
| `product_discount` | ✅ | Tabela LineItem |

---

## 🎯 Próximos Passos

Depois de fazer o sync correto:
1. Verifique se a order do Ahmed Hamada mostra os dados corretos
2. Se **sim**: problema resolvido! 🎉
3. Se **não**: Os campos estão vazios no HubSpot ➡️ precisa preencher no HubSpot primeiro

---

## 📝 Notas Técnicas

- A query SQL foi corrigida para remover campos inexistentes
- Apenas campos confirmados no `HUBSPOT-AVAILABLE-COLUMNS.md` são usados
- O sistema tem fallback automático para query simples se a enriquecida falhar
- Remember Me foi implementado para manter sessão por 30 dias

---

## 🔗 Arquivos Alterados

- `src/lib/hubspot-queries.ts` - Query SQL corrigida
- `src/app/api/hubspot/sync/route.ts` - Mapeamento de campos
- `src/app/reports/hubspot/page.tsx` - Interface simplificada
- `src/components/auth/LoginForm.tsx` - Remember Me adicionado
- `src/contexts/auth-context.tsx` - Persistência de sessão
