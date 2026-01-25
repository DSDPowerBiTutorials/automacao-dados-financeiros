# 🤖 **BOT**ella - Sistema de Automação

## Visão Geral

**BOT**ella é o sistema de automação do DSD Finance Hub. O nome aparece com as três primeiras letras (**BOT**) em negrito, destacando sua natureza de bot automatizado.

---

## 📦 Componentes

### 1. Migration SQL
**Arquivo:** `migrations/20260125_create_botella.sql`

Execute no Supabase SQL Editor para criar:
- Tabela `bot_logs` - Logs de todas as tarefas automáticas
- Tabela `bot_tasks` - Configuração das tarefas agendadas
- Role `bot` - Permissões específicas para automação
- Função `log_bot_action()` - Helper SQL para logging
- View `bot_activity_summary` - Resumo de atividades

### 2. Biblioteca TypeScript
**Arquivo:** `src/lib/botella.ts`

Funções disponíveis:
```typescript
import { 
  startBotTask,      // Inicia uma tarefa
  completeBotTask,   // Finaliza com sucesso
  failBotTask,       // Finaliza com erro
  warnBotTask,       // Finaliza com warning
  updateBotProgress, // Atualiza progresso
  runBotTask,        // Wrapper com tratamento automático
  logBotAction,      // Log simples sem contexto
  getBotLogs,        // Consultar logs
  getBotTasks,       // Listar tarefas configuradas
  getBotStats,       // Estatísticas
  BOT_NAME,          // "BOTella"
  BOT_CONSOLE_NAME,  // "🤖 BOTella"
  BOT_NAME_PARTS     // { bold: "BOT", normal: "ella" }
} from "@/lib/botella";
```

### 3. Página de Logs
**Rota:** `/actions/bot-logs`

Interface para visualizar:
- Logs de execução com filtros
- Estatísticas dos últimos 7 dias
- Tarefas configuradas (ativar/desativar)

---

## 🚀 Uso

### Exemplo Básico

```typescript
import { startBotTask, completeBotTask, failBotTask } from "@/lib/botella";

async function minhaTarefaAutomatica() {
  const ctx = await startBotTask("Minha Tarefa", "sync");
  
  try {
    // Sua lógica aqui...
    ctx.recordsProcessed = 100;
    ctx.recordsCreated = 50;
    
    await completeBotTask(ctx, "Tarefa concluída com sucesso!");
  } catch (error) {
    await failBotTask(ctx, error);
    throw error;
  }
}
```

### Usando o Wrapper

```typescript
import { runBotTask } from "@/lib/botella";

const resultado = await runBotTask("Minha Tarefa", "sync", async (ctx) => {
  // Sua lógica aqui...
  ctx.recordsProcessed = 100;
  return { sucesso: true };
});
```

### Log Simples (Sem Contexto)

```typescript
import { logBotAction } from "@/lib/botella";

await logBotAction(
  "Notificação Enviada", 
  "notification", 
  "completed", 
  "Email enviado para 50 usuários"
);
```

---

## 📋 Tarefas Configuradas

| Task Key | Nome | Tipo | Schedule | Descrição |
|----------|------|------|----------|-----------|
| `daily_sync` | Sincronização Diária | sync | `0 4 * * *` | Todos os sistemas |
| `braintree_eur_sync` | Braintree EUR | sync | `0 4 * * *` | Transações EUR |
| `braintree_usd_sync` | Braintree USD | sync | `0 4 * * *` | Transações USD |
| `gocardless_sync` | GoCardless | sync | `0 4 * * *` | Pagamentos DD |
| `hubspot_sync` | HubSpot | sync | `0 4 * * *` | Deals e clientes |
| `stripe_sync` | Stripe | sync | `0 4 * * *` | Pagamentos Stripe |
| `quickbooks_sync` | QuickBooks | sync | `0 4 * * *` | Dados EUA |
| `auto_reconciliation` | Reconciliação | reconciliation | `0 5 * * *` | Matching automático |
| `order_linking` | Order Linking | reconciliation | `*/30 * * * *` | Vinculação Order IDs |
| `cleanup_old_logs` | Limpeza de Logs | cleanup | `0 3 * * 0` | Remove logs >90 dias |
| `daily_backup` | Backup Diário | backup | `0 2 * * *` | Backup (desativado) |

---

## 📊 Tipos de Tarefas

| Tipo | Descrição | Ícone |
|------|-----------|-------|
| `sync` | Sincronização de dados | 🔄 |
| `reconciliation` | Reconciliação de transações | ⚡ |
| `cleanup` | Limpeza e manutenção | 🗑️ |
| `notification` | Envio de notificações | 🔔 |
| `backup` | Backups de dados | 📦 |

---

## 📈 Status de Tarefas

| Status | Significado | Emoji |
|--------|-------------|-------|
| `started` | Tarefa iniciada | ▶️ |
| `running` | Em execução | 🔄 |
| `completed` | Concluída com sucesso | ✅ |
| `failed` | Falhou | ❌ |
| `warning` | Parcialmente bem-sucedida | ⚠️ |

---

## 🔧 Setup

### 1. Executar Migration

```sql
-- No Supabase SQL Editor:
-- Copiar e colar: migrations/20260125_create_botella.sql
```

### 2. Verificar Tabelas

```sql
SELECT * FROM bot_tasks ORDER BY task_type;
SELECT * FROM bot_logs ORDER BY created_at DESC LIMIT 10;
```

### 3. Acessar Página de Logs

Navegue para: `/actions/bot-logs`

---

## 🎨 Exibição do Nome

O nome **BOT**ella sempre aparece com formatação especial:

### React
```tsx
<span>
  <strong className="font-bold">BOT</strong>ella
</span>
```

### Console
```
🤖 BOTella [Tarefa] ✅ Concluído
```

### Markdown
**BOT**ella

---

## 📝 Notas

- Os logs são retidos por 90 dias (tarefa de limpeza semanal)
- Tarefas podem ser ativadas/desativadas na página de logs
- Estatísticas mostram os últimos 7 dias de atividade
- O cron job principal (`/api/cron/daily-sync`) já está integrado

---

**Sistema:** DSD Finance Hub  
**Versão:** 1.0  
**Data:** 2026-01-25
