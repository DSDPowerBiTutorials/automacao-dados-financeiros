# 🧪 HubSpot Matching System - Guia de Testes

## 📋 Checklist de Implementação

### ✅ Fase 1: Infraestrutura (CONCLUÍDA)
- [x] Algoritmo de matching engine implementado
- [x] APIs de sync e auto-match criadas
- [x] Interface UI com indicadores de match atualizada
- [x] Documentação completa gerada
- [x] Código commitado e pushed para GitHub

### ⏳ Fase 2: Schema Database (PENDENTE)
- [ ] Aplicar migration SQL no Supabase
- [ ] Verificar índices criados
- [ ] Testar inserção de dados com novos campos

### ⏳ Fase 3: Testes Funcionais (PENDENTE)
- [ ] Teste de sincronização HubSpot → Supabase
- [ ] Teste de auto-match em modo dry-run
- [ ] Teste de auto-match em modo produção
- [ ] Validação de indicadores visuais na UI

---

## 🚀 Passo-a-Passo para Deploy

### **Passo 1: Aplicar Migration no Supabase**

1. Acesse o Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql/new

2. Execute o SQL do arquivo `supabase-migration-matching.sql`:

```sql
-- Copiar e colar todo o conteúdo do arquivo no SQL Editor
-- Clicar em "Run" para executar
```

3. Verificar se os campos foram adicionados:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'csv_rows'
ORDER BY ordinal_position;
```

✅ **Resultado esperado:** Deve mostrar os novos campos:
- `customer_email` (TEXT)
- `customer_name` (TEXT)
- `matched_with` (UUID)
- `matched_source` (TEXT)
- `match_confidence` (INTEGER)
- `match_details` (JSONB)
- `matched_at` (TIMESTAMPTZ)

---

### **Passo 2: Sincronizar Dados do HubSpot**

1. Acesse a página: http://localhost:3000/reports/hubspot

2. Clique no botão **"Sincronizar"** (ícone de refresh)

3. Aguarde a mensagem de sucesso

4. Verifique se os dados apareceram na tabela

✅ **Resultado esperado:**
- Novos registros aparecem na lista
- Campos `customer_email` e `customer_name` preenchidos
- Deal IDs visíveis
- Valores e datas corretos

**Verificação SQL:**
```sql
SELECT 
    id, 
    date, 
    description, 
    amount, 
    customer_email, 
    customer_name,
    custom_data->>'deal_id' as deal_id
FROM csv_rows
WHERE source = 'hubspot'
ORDER BY date DESC
LIMIT 10;
```

---

### **Passo 3: Simular Auto-Match (Dry Run)**

1. Na mesma página `/reports/hubspot`

2. Clique no botão **"Simular Matches"**

3. Aguarde a análise (pode levar alguns segundos)

4. Observe as estatísticas que aparecem:
   - Analisados
   - Matches Encontrados
   - Sem Match
   - Confiança Média

✅ **Resultado esperado:**
- Estatísticas aparecem no card roxo
- Nenhum registro é realmente modificado no banco
- Console mostra detalhes do matching

**Verificação SQL (deve retornar vazio porque é dry-run):**
```sql
SELECT COUNT(*) FROM csv_rows WHERE matched_with IS NOT NULL;
```

---

### **Passo 4: Executar Auto-Match Real**

⚠️ **ATENÇÃO:** Este passo modifica o banco de dados!

1. Clique no botão **"Executar Auto-Match"** (botão roxo)

2. Aguarde processamento

3. Observe os indicadores de match aparecerem:
   - 🟢 Verde: confiança ≥ 85%
   - 🟡 Amarelo: confiança 70-84%
   - 🔴 Vermelho: confiança < 70%

✅ **Resultado esperado:**
- Registros com matches mostram badges coloridos
- Card de estatísticas atualiza com número de "Matched"
- Status "Conciliado" é marcado automaticamente

**Verificação SQL:**
```sql
-- Ver pares reconciliados
SELECT * FROM reconciled_pairs
LIMIT 10;

-- Contar matches por confiança
SELECT 
    CASE 
        WHEN match_confidence >= 85 THEN 'Alto (≥85%)'
        WHEN match_confidence >= 70 THEN 'Médio (70-84%)'
        ELSE 'Baixo (<70%)'
    END as nivel_confianca,
    COUNT(*) as total
FROM csv_rows
WHERE matched_with IS NOT NULL
GROUP BY nivel_confianca;
```

---

### **Passo 5: Validação Manual**

Verifique alguns matches manualmente para garantir qualidade:

```sql
-- Buscar um par específico
SELECT 
    a.id as hubspot_id,
    a.date as hubspot_date,
    a.description as hubspot_desc,
    a.amount as hubspot_amount,
    a.customer_email as hubspot_email,
    
    b.id as payment_id,
    b.source as payment_source,
    b.date as payment_date,
    b.description as payment_desc,
    b.amount as payment_amount,
    
    a.match_confidence,
    a.match_details
FROM csv_rows a
INNER JOIN csv_rows b ON a.matched_with = b.id
WHERE a.source = 'hubspot' AND b.source LIKE '%braintree%'
LIMIT 5;
```

✅ **Resultado esperado:**
- Emails devem ser similares ou iguais
- Datas devem estar próximas (±3 dias)
- Valores devem ser próximos (±€0.01 ou ±5%)
- `match_details` deve mostrar scores detalhados

---

## 🔍 Testes de Edge Cases

### Teste 1: Email com Variações
```sql
-- Inserir registros de teste com emails similares
INSERT INTO csv_rows (source, date, description, amount, customer_email, customer_name)
VALUES 
    ('hubspot', '2025-01-15', 'Test Deal', 100.00, 'john.doe+test@example.com', 'John Doe'),
    ('braintree-eur', '2025-01-16', 'Payment Test', 100.00, 'john.doe@example.com', 'John Doe');

-- Rodar auto-match
-- Verificar se fez match mesmo com +test no email
```

### Teste 2: Nomes com Acentos/Unicode
```sql
INSERT INTO csv_rows (source, date, description, amount, customer_email, customer_name)
VALUES 
    ('hubspot', '2025-01-15', 'Test Deal 2', 200.00, 'test@example.com', 'José María'),
    ('sabadell', '2025-01-15', 'Payment Test 2', 200.00, 'test@example.com', 'Jose Maria');

-- Rodar auto-match
-- Verificar se normalizou corretamente José→Jose e María→Maria
```

### Teste 3: Diferença de Data no Limite (3 dias)
```sql
INSERT INTO csv_rows (source, date, description, amount, customer_email, customer_name)
VALUES 
    ('hubspot', '2025-01-10', 'Test Deal 3', 300.00, 'limit@example.com', 'Limit Test'),
    ('braintree-eur', '2025-01-13', 'Payment Test 3', 300.00, 'limit@example.com', 'Limit Test');

-- Rodar auto-match
-- Deve fazer match (diferença de exatamente 3 dias)
```

### Teste 4: Diferença de Valor no Limite (5%)
```sql
INSERT INTO csv_rows (source, date, description, amount, customer_email, customer_name)
VALUES 
    ('hubspot', '2025-01-15', 'Test Deal 4', 100.00, 'value@example.com', 'Value Test'),
    ('stripe', '2025-01-15', 'Payment Test 4', 104.99, 'value@example.com', 'Value Test');

-- Rodar auto-match
-- Deve fazer match (diferença de ~5%)
```

---

## 📊 Métricas de Sucesso

### KPIs para Validar Sistema

| Métrica | Target | Como Medir |
|---------|--------|-----------|
| Taxa de Match Automático | ≥ 70% | `(matched / total_hubspot) * 100` |
| Confiança Média | ≥ 80% | `AVG(match_confidence)` |
| Falsos Positivos | < 5% | Validação manual de amostra |
| Tempo de Processamento | < 30s para 100 registros | Logs da API |

### Queries de Monitoramento

```sql
-- Taxa de match geral
SELECT 
    COUNT(*) FILTER (WHERE matched_with IS NOT NULL) as matched,
    COUNT(*) as total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE matched_with IS NOT NULL) / COUNT(*), 2) as taxa_match
FROM csv_rows
WHERE source = 'hubspot';

-- Confiança média por source pareado
SELECT 
    b.source as payment_source,
    COUNT(*) as total_matches,
    ROUND(AVG(a.match_confidence), 2) as confianca_media,
    MIN(a.match_confidence) as min_confianca,
    MAX(a.match_confidence) as max_confianca
FROM csv_rows a
INNER JOIN csv_rows b ON a.matched_with = b.id
WHERE a.source = 'hubspot'
GROUP BY b.source;

-- Distribuição de scores
SELECT 
    match_details->>'emailScore' as email_score,
    match_details->>'nameScore' as name_score,
    match_details->>'dateScore' as date_score,
    match_details->>'amountScore' as amount_score,
    match_confidence
FROM csv_rows
WHERE matched_with IS NOT NULL
ORDER BY match_confidence DESC
LIMIT 20;
```

---

## 🐛 Troubleshooting

### Problema: "Erro ao sincronizar: Cannot connect to SQL Server"

**Solução:**
```bash
# Verificar variáveis de ambiente
echo $MSSQL_SERVER
echo $MSSQL_DATABASE
echo $MSSQL_USER
# Senha não mostrar por segurança!

# Testar conexão manualmente
node scripts/hubspot-investigate-tables.js
```

### Problema: "Auto-match não encontra nenhum match"

**Possíveis causas:**
1. Falta de dados em uma das fontes (HubSpot ou Payment Channels)
2. Campos `customer_email` vazios
3. Diferenças muito grandes em datas ou valores

**Diagnóstico:**
```sql
-- Verificar disponibilidade de emails
SELECT 
    source,
    COUNT(*) as total,
    COUNT(customer_email) as with_email,
    ROUND(100.0 * COUNT(customer_email) / COUNT(*), 2) as pct_email
FROM csv_rows
GROUP BY source;

-- Verificar se há registros não reconciliados
SELECT source, COUNT(*) 
FROM csv_rows 
WHERE reconciled = false
GROUP BY source;
```

### Problema: "Match confidence muito baixa (<70%)"

**Causas comuns:**
- Emails completamente diferentes
- Nomes muito diferentes (typos, abreviações)
- Data fora do range de ±3 dias
- Valor com diferença > 5%

**Investigação:**
```sql
-- Ver detalhes dos matches de baixa confiança
SELECT 
    a.customer_email as hubspot_email,
    b.customer_email as payment_email,
    a.customer_name as hubspot_name,
    b.customer_name as payment_name,
    a.date as hubspot_date,
    b.date as payment_date,
    a.amount as hubspot_amount,
    b.amount as payment_amount,
    a.match_confidence,
    a.match_details
FROM csv_rows a
INNER JOIN csv_rows b ON a.matched_with = b.id
WHERE a.match_confidence < 70
ORDER BY a.match_confidence ASC;
```

---

## 🎯 Próximos Passos

Após validar todos os testes:

1. **Deploy para Produção:**
   ```bash
   git add .
   git commit -m "feat: HubSpot auto-matching system with fuzzy logic"
   git push origin main
   ```

2. **Monitorar Vercel Deploy:**
   - Aguardar build automático
   - Verificar logs de deploy
   - Testar em produção

3. **Configurar Rotinas Automáticas:**
   - Criar cron job para sincronização diária
   - Setup de alertas para matches de baixa confiança
   - Dashboard de métricas de reconciliação

4. **Documentar para Usuários Finais:**
   - Manual de operação
   - FAQ de erros comuns
   - Vídeos de treinamento

---

## 📝 Relatório de Testes

Preencha conforme executa os testes:

```
Data do Teste: ______________
Testado por: ______________

[ ] Passo 1: Migration aplicada com sucesso
[ ] Passo 2: Sincronização funcionando
[ ] Passo 3: Dry-run executado
[ ] Passo 4: Auto-match real executado
[ ] Passo 5: Validação manual aprovada

Estatísticas Obtidas:
- Total de registros HubSpot: _______
- Total de matches encontrados: _______
- Taxa de match: _______%
- Confiança média: _______%

Observações/Problemas:
_________________________________________________
_________________________________________________
_________________________________________________

Aprovação: [ ] SIM  [ ] NÃO (motivo: ___________)
```

---

**Última atualização:** 2025-01-30  
**Versão:** 1.0  
**Status:** 🟡 Aguardando execução dos testes
