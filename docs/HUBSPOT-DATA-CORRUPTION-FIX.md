# 🔧 Guia: Como Resolver Dados Corrompidos do HubSpot

## 🎯 Problema

Os dados do HubSpot no Supabase estão "zoados" (corrompidos, incompletos ou com campos NULL).

**Sintomas comuns:**
- Campos `ecomm_order_number` ou `website_order_id` estão NULL
- `product_quantity` ou `product_amount` faltando
- Dados de Contact/Company não aparecem
- Linkagem com Braintree/Stripe não funciona

---

## 📊 Diagnóstico: Por Que Isso Acontece?

### 1. Query Enriquecida Falhou

O sistema tenta 3 queries em cascata:

| Ordem | Query | Dados Incluídos |
|-------|-------|-----------------|
| **1º** | Enriquecida | Deal + Contact + Company + **LineItem** (produtos) |
| **2º** | Intermediária | Deal + Contact + Company (sem LineItem) |
| **3º** | Simples | Apenas Deal + Contact básico |

Se a query **Enriquecida** falhar (tabela LineItem não existe ou não tem permissão), o sistema cai para Intermediária ou Simples, **perdendo dados importantes**.

### 2. Campos Não Existem no SQL Server

Alguns campos podem não existir no schema do seu HubSpot SQL:
- `ip__ecomm_bridge__order_number` (campo de integração e-commerce)
- `website_order_id` (ID de pedidos web)
- `paid_status`, `coupon_code`, etc.

### 3. Relacionamentos Quebrados

As tabelas de relacionamento podem não existir:
- `DealContactAssociations` (Deal ↔ Contact)
- `DealCompanyAssociations` (Deal ↔ Company)
- `DealLineItemAssociations` (Deal ↔ Produtos)

---

## ✅ SOLUÇÃO: Passo a Passo

### Passo 1: Verificar Schema do SQL Server

Na página `/reports/hubspot`, clique em **"Verificar Schema"**.

Isso vai:
1. ✓ Listar todas as colunas da tabela `Deal`
2. ✓ Verificar se campos críticos existem
3. ✓ Verificar se tabelas relacionadas existem
4. ✓ Dar recomendações específicas

**No console (F12), você verá:**
```
📊 Schema verificado:
✓ 239 colunas na tabela Deal
✓ 8/12 campos críticos encontrados
✓ 5/6 tabelas relacionadas disponíveis

⚠️ Campo ip__ecomm_bridge__order_number não encontrado.
⚠️ Tabela LineItem não encontrada. Query enriquecida pode falhar.
```

### Passo 2: Limpar & Re-Sincronizar

Se os dados estão corrompidos, você **DEVE deletar e sincronizar de novo**.

**Na página `/reports/hubspot`:**
1. Clique em **"Limpar & Re-Sincronizar"**
2. Confirme a ação (⚠️ deleta TODOS os dados do HubSpot)
3. O sistema irá:
   - Deletar registros antigos
   - Buscar dados frescos do SQL Server
   - Usar a melhor query disponível (enriquecida → intermediária → simples)

**Automaticamente, o sistema:**
- ✓ Tenta query enriquecida primeiro
- ✓ Se falhar, tenta intermediária
- ✓ Se falhar, usa simples (garantido de funcionar)

### Passo 3: Verificar Logs

Após sincronizar, abra o **Console (F12)** e procure por:

```
✅ Query enriquecida funcionou! 1234 deals
🛒 123 deals com ecomm_order_number (10.0%)
📧 1100 deals com email (89.0%)
```

ou

```
❌ Query enriquecida FALHOU: Invalid object name 'DealLineItemAssociations'
✅ Query intermediária funcionou! 1234 deals
```

---

## 🔍 Investigação Avançada

### Endpoint: GET /api/hubspot/schema

Retorna estrutura completa do SQL Server:

```bash
curl https://your-domain.vercel.app/api/hubspot/schema
```

**Resposta:**
```json
{
  "success": true,
  "table": "Deal",
  "totalColumns": 239,
  "columns": [...],
  "criticalFields": [
    { "field": "ip__ecomm_bridge__order_number", "exists": false },
    { "field": "website_order_id", "exists": true, "dataType": "nvarchar" }
  ],
  "relatedTables": [
    { "table": "Contact", "exists": true },
    { "table": "LineItem", "exists": false }
  ],
  "recommendations": [
    "⚠️ Tabela LineItem não encontrada. Query enriquecida pode falhar."
  ]
}
```

### Endpoint: DELETE /api/hubspot/cleanup

Deleta TODOS os dados do HubSpot (use com cuidado):

```bash
curl -X DELETE https://your-domain.vercel.app/api/hubspot/cleanup
```

### Script Node.js

Você também pode verificar o schema localmente:

```bash
node scripts/list-hubspot-columns.js
```

Isso gera `docs/HUBSPOT-AVAILABLE-COLUMNS.json` com todas as colunas disponíveis.

---

## 🎯 Qual Query Foi Usada?

Após sincronizar, cada registro no Supabase tem um campo `custom_data.query_type`:

```sql
SELECT 
  custom_data->>'query_type' as query_used,
  COUNT(*) as total
FROM csv_rows
WHERE source = 'hubspot'
GROUP BY custom_data->>'query_type';
```

**Resultados possíveis:**
- `enriched` → Melhor caso (todos os dados)
- `intermediate` → Dados parciais (sem LineItem)
- `simple` → Mínimo necessário (Deal + Contact básico)

---

## 🚨 Casos Específicos

### Caso 1: Campo `ip__ecomm_bridge__order_number` Não Existe

**Sintoma:** Linkagem com Braintree/Stripe não funciona.

**Solução:**
1. Verifique se o campo existe no schema (`Verificar Schema`)
2. Se não existir, use outro campo de identificação:
   - `website_order_id`
   - `dealname` (extrair código do nome)
3. Atualize a lógica de matching em [src/lib/matching-engine.ts](src/lib/matching-engine.ts)

### Caso 2: Tabela `LineItem` Não Existe

**Sintoma:** `product_quantity` e `product_amount` sempre NULL.

**Solução:**
1. A query intermediária será usada automaticamente
2. Produtos não estarão disponíveis
3. Considere buscar produtos de outra fonte (API do HubSpot?)

### Caso 3: Todos os Deals com `customer_email` NULL

**Sintoma:** Nenhum deal tem email do cliente.

**Causa:** Tabela `DealContactAssociations` não existe ou não tem dados.

**Solução:**
1. Verifique relacionamento no SQL Server
2. Confirme que deals estão associados a contatos
3. Use API do HubSpot para enriquecer dados se necessário

---

## 📝 Checklist Final

Após resolver o problema:

- [ ] **Verificar Schema** → Todos os campos críticos existem?
- [ ] **Limpar & Re-Sincronizar** → Dados foram atualizados?
- [ ] **Verificar Logs** → Qual query foi usada (enriched/intermediate/simple)?
- [ ] **Verificar Linkagem** → Matching com Braintree/Stripe funciona?
- [ ] **Verificar Produtos** → `product_quantity` e `product_amount` preenchidos?
- [ ] **Verificar Emails** → `customer_email` presente nos deals?

---

## 🆘 Ainda com Problemas?

Se após seguir todos os passos os dados ainda estiverem incorretos:

1. **Capture logs completos:**
   - Abra Console (F12)
   - Limpe o console
   - Execute "Limpar & Re-Sincronizar"
   - Copie TODOS os logs

2. **Capture schema:**
   ```bash
   curl https://your-domain.vercel.app/api/hubspot/schema > schema.json
   ```

3. **Verifique tabelas SQL Server:**
   ```bash
   node scripts/hubspot-investigate-tables.js
   ```

4. **Abra issue com:**
   - Logs da sincronização
   - Arquivo `schema.json`
   - Output de `hubspot-investigate-tables.js`
   - Descrição do problema esperado vs. obtido

---

## 💡 Próximas Melhorias

Futuras implementações para tornar o sistema mais robusto:

- [ ] **Auto-detecção de campos:** Query dinâmica baseada no schema
- [ ] **Fallback para API:** Se SQL falhar, usar API do HubSpot
- [ ] **Cache de schema:** Armazenar estrutura para não verificar sempre
- [ ] **Alertas automáticos:** Notificar quando query enriquecida falha
- [ ] **Testes de integração:** Validar queries antes de executar

---

**Última atualização:** 2025-01-05  
**Versão do sistema:** 2.0 (com queries em cascata)
