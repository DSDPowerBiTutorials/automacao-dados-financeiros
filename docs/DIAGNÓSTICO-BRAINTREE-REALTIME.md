# Diagnóstico: Por que Braintree não atualiza em tempo real

## 🔴 3 Problemas Identificados

### 1️⃣ **Webhook NÃO trata eventos de transação (CRITICAL)**
**Arquivo:** `src/app/api/braintree/webhook/route.ts`

**Problema:**
- O webhook lista eventos como "subscription_charged_successfully" ✅
- Mas **NÃO trata eventos padrão de transação** ❌:
  - `transaction_authorized` - quando autoriza
  - `transaction_settlement_pending` - quando entra em liquidação
  - `transaction_settled` - quando confirma
  - `transaction_settlement_declined` - quando falha
  - `transaction_voided` - quando cancela
  - `transaction_submitted_for_settlement` - quando envia para liquidação

**Impacto:**
- ❌ Transações diretas (não subscription) NÃO são sincronizadas
- ❌ Pagamentos únicos não aparecem nos reports
- ❌ Apenas subscriptions são tratadas

**Solução:**
Adicionar handlers para eventos de transação padrão.

---

### 2️⃣ **Página Braintree NÃO tem Realtime Listener (CRITICAL)**
**Arquivo:** `src/app/reports/braintree/page.tsx` (linha 36-39)

**Problema:**
```typescript
useEffect(() => {
  loadStats();
}, []); // ❌ Executa UMA VEZ ao montar, nunca mais atualiza
```

**Impacto:**
- ❌ Dados carregam apenas na primeira visita
- ❌ Mudanças no banco de dados não aparecem
- ❌ Precisa recarregar a página manualmente (F5)
- ❌ Qualquer novo pagamento fica invisível

**Solução:**
Adicionar `supabase.on('postgres_changes')` para escutar mudanças em tempo real.

---

### 3️⃣ **Sincronização via Cron Job muito espaçada**
**Arquivo:** `vercel.json`

**Problema:**
```json
{
  "path": "/api/cron/braintree-sync",
  "schedule": "0 4 * * *"  // ❌ Executa apenas 1x por dia às 4:00 AM
}
```

**Impacto:**
- ❌ Atualiza dados apenas 1x por dia
- ❌ Pagamentos de hoje podem levar 24h para aparecer
- ❌ Usuários veem dados desatualizados

**Solução:**
Aumentar frequência para a cada 1-2 horas.

---

## 🔧 Soluções Implementáveis

### Solução 1: Adicionar Eventos de Transação ao Webhook
**Prioridade:** 🔴 **CRÍTICA**

```typescript
// Adicionar ao handledEvents array
const handledEvents = [
  // Transações diretas
  "transaction_authorized",           // ✅ NOVO
  "transaction_settlement_pending",   // ✅ NOVO
  "transaction_settled",              // ✅ NOVO
  "transaction_settlement_declined",  // ✅ NOVO
  "transaction_voided",               // ✅ NOVO
  "transaction_submitted_for_settlement", // ✅ NOVO
  
  // ... resto dos eventos
];
```

E adicionar handler:
```typescript
if (["transaction_authorized", "transaction_settled", ...].includes(eventKind)) {
  const transaction = webhookNotification.transaction;
  // Processar como faz com subscription
}
```

---

### Solução 2: Adicionar Realtime Listener à Página
**Prioridade:** 🔴 **CRÍTICA**

```typescript
useEffect(() => {
  loadStats();

  // ✅ Escutar mudanças em tempo real
  const subscription = supabase
    .channel('csv_rows_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'csv_rows',
        filter: "source=eq.braintree-api-revenue" // Filtro importante!
      },
      (payload) => {
        console.log('Mudança detectada:', payload);
        loadStats(); // Recarregar dados
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

### Solução 3: Aumentar Frequência do Cron
**Prioridade:** 🟡 **IMPORTANTE** (complemento às outras soluções)

```json
{
  "path": "/api/cron/braintree-sync",
  "schedule": "0 */2 * * *"  // ✅ A cada 2 horas
}
```

Ou até:
```json
{
  "path": "/api/cron/braintree-sync",
  "schedule": "*/30 * * * *"  // A cada 30 minutos (mais agressivo)
}
```

---

## 📊 Fluxo Esperado Atual vs. Esperado

### ❌ ATUAL (não funciona):
1. Transação ocorre no Braintree
2. Webhook recebe evento mas ignora (não está no `handledEvents`)
3. Cron job roda 1x/dia (desatualizado)
4. Página não escuta mudanças
5. ❌ Usuário precisa recarregar manualmente

### ✅ ESPERADO (após fixes):
1. Transação ocorre no Braintree
2. Webhook recebe evento E processa em tempo real ✅
3. Dados salvos no Supabase
4. Página recebe notificação Realtime ✅
5. UI atualiza automaticamente em <1 segundo ✅
6. Cron job como backup (não é necessário para RT, mas útil)

---

## 🚀 Próximas Ações

**Recomendação:** Implementar Soluções 1 + 2 primeiro (hoje mesmo)
- Solução 1: 30 minutos
- Solução 2: 20 minutos
- Solução 3: 5 minutos

Total: ~1 hora para realtime funcional 100%

---

## 📝 Notas
- Webhook está funcionando (recebe eventos)
- Mas ignora 90% dos eventos de transação
- Realtime do Supabase está disponível e pronto
- Apenas falta conectar listeners na UI
