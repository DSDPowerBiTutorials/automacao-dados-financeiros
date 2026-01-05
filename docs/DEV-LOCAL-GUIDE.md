# 🚀 Guia de Desenvolvimento Local - Sistema Completo

## ✅ Resposta Rápida: SIM!

**SIM, você pode desenvolver 100% em ambiente local** com a mesma experiência de produção, incluindo:
- ✅ APIs de HubSpot (sync, auto-match)
- ✅ SQL Server Azure
- ✅ Supabase
- ✅ Todas as funcionalidades de UI
- ✅ Hot reload e updates instantâneos

---

## 🔧 Como Desenvolver Localmente

### 1. **Iniciar Servidor de Desenvolvimento**

```bash
npm run dev
```

**O que acontece:**
- ✅ Servidor Next.js roda em `http://localhost:3000`
- ✅ Hot reload: mudanças no código atualizam automaticamente
- ✅ APIs funcionam em `/api/*` (mesmo path de produção)
- ✅ Conecta ao MESMO Supabase de produção
- ✅ Conecta ao MESMO SQL Server Azure

### 2. **Acessar a Aplicação**

```
http://localhost:3000/dashboard
http://localhost:3000/reports/hubspot
http://localhost:3000/reports/braintree-eur
```

**Funcionalidades Disponíveis:**
- ✅ Sincronizar dados do HubSpot
- ✅ Auto-match inteligente
- ✅ Editar registros
- ✅ Exportar CSV
- ✅ Ver indicadores de match 🟢🟡

---

## 📊 Comparação: Dev vs Produção

| Recurso | Desenvolvimento (`npm run dev`) | Produção (Vercel) |
|---------|--------------------------------|-------------------|
| **Hot Reload** | ✅ SIM (instantâneo) | ❌ Precisa rebuild |
| **APIs** | ✅ Funcionam | ✅ Funcionam |
| **Supabase** | ✅ Mesma database | ✅ Mesma database |
| **SQL Server** | ✅ Mesma conexão | ✅ Mesma conexão |
| **Performance** | ⚠️ Modo debug (mais lento) | ✅ Otimizado |
| **Logs Detalhados** | ✅ No terminal | ⚠️ Logs do Vercel |
| **Testing** | ✅ Fácil testar mudanças | ⚠️ Precisa deploy |
| **Debugger** | ✅ Breakpoints funcionam | ❌ Não |

---

## 🎯 Workflow Recomendado

### Para Desenvolvimento Diário:

```bash
# 1. Iniciar dev server
npm run dev

# 2. Abrir navegador
# http://localhost:3000

# 3. Fazer mudanças no código
# Salvar arquivo → Atualiza automaticamente

# 4. Testar APIs diretamente:
curl http://localhost:3000/api/hubspot/sync -X POST

# 5. Ver logs no terminal em tempo real
```

### Para Deploy em Produção:

```bash
# Apenas quando estiver satisfeito com mudanças:
git add .
git commit -m "feat: nova funcionalidade"
git push origin main

# Vercel detecta automaticamente e faz deploy
# Aguardar ~2-3 minutos
```

---

## 🔍 Vantagens do Desenvolvimento Local

### 1. **Feedback Instantâneo**
- Mudou código → Salva → Vê resultado em 1 segundo
- Não precisa esperar build do Vercel (2-3 min)

### 2. **Debugging Completo**
```javascript
// Adicione console.logs onde quiser
console.log('Debug:', data);

// Use debugger
debugger; // Pausa execução no browser
```

### 3. **Experimentação Segura**
- Pode quebrar código sem afetar produção
- Testa antes de commitar

### 4. **Performance de Network**
- APIs locais são MUITO mais rápidas
- Não depende de internet

---

## 📝 Exemplo Prático de Workflow

### Cenário: Adicionar novo campo na tabela HubSpot

**❌ Workflow RUIM (só produção):**
```
1. Editar código (5 min)
2. Commitar e push (1 min)
3. Aguardar Vercel build (3 min)
4. Testar em produção (2 min)
5. Encontrar bug (0 min - já perdeu tempo!)
6. Repetir passos 1-4... (11 min cada iteração)

Total: 30-60 minutos para 3 iterações
```

**✅ Workflow BOM (desenvolvimento local):**
```
1. npm run dev (10 segundos - só uma vez)
2. Editar código (5 min)
3. Salvar → Testar instantaneamente (10 seg)
4. Encontrar bug → Corrigir (2 min)
5. Salvar → Testar → OK! (10 seg)
6. Commitar e push (1 min)
7. Deploy automático Vercel (3 min em background)

Total: 8 minutos + você já sabe que funciona!
```

---

## 🛠️ Comandos Úteis para Dev Local

### Desenvolvimento:
```bash
# Iniciar dev server
npm run dev

# Verificar erros TypeScript
npm run type-check

# Rodar linter
npm run lint

# Limpar cache e reiniciar
rm -rf .next && npm run dev
```

### Testes de API (no terminal):
```bash
# Testar sync HubSpot
curl -X POST http://localhost:3000/api/hubspot/sync

# Testar auto-match (dry-run)
curl -X POST http://localhost:3000/api/hubspot/auto-match \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Testar auto-match (real)
curl -X POST http://localhost:3000/api/hubspot/auto-match \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# Ver estatísticas
curl http://localhost:3000/api/hubspot/auto-match
```

### Ver Logs em Tempo Real:
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Monitorar logs
tail -f .next/server/app/api/hubspot/sync.log

# Ou simplesmente olhe o terminal onde rodou npm run dev
# Todos os console.logs aparecem lá!
```

---

## 🌐 URLs Importantes

### Desenvolvimento Local:
```
Dashboard:              http://localhost:3000/dashboard
HubSpot Reports:        http://localhost:3000/reports/hubspot
Braintree EUR:          http://localhost:3000/reports/braintree-eur
API Sync:               http://localhost:3000/api/hubspot/sync
API Auto-Match:         http://localhost:3000/api/hubspot/auto-match
```

### Produção (após deploy):
```
Dashboard:              https://seu-dominio.vercel.app/dashboard
HubSpot Reports:        https://seu-dominio.vercel.app/reports/hubspot
```

**IMPORTANTE:** Ambos usam a MESMA database Supabase! Dados são compartilhados.

---

## ⚠️ Cuidados no Desenvolvimento Local

### 1. **Database Compartilhada**
- Dev e Produção usam o MESMO Supabase
- Mudanças em dev AFETAM produção
- **Solução:** Use flags ou campos de teste

### 2. **Environment Variables**
Certifique-se que `.env.local` tem todas as variáveis:
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
MSSQL_SERVER=datawarehouse-io-eur.database.windows.net
MSSQL_DATABASE=Jorge9660
MSSQL_USER=Jorge6368
MSSQL_PASSWORD=...
```

### 3. **Hot Reload Issues**
Se mudanças não aparecem:
```bash
# Limpar cache
rm -rf .next
npm run dev
```

---

## 📦 Quando Usar Cada Ambiente

| Situação | Use... |
|----------|--------|
| Desenvolver nova feature | 🔧 Dev Local |
| Testar mudanças rapidamente | 🔧 Dev Local |
| Debuggar código | 🔧 Dev Local |
| Experimentar sem risco | 🔧 Dev Local |
| Mostrar para stakeholders | 🚀 Produção |
| Usuários finais usarem | 🚀 Produção |
| Sistema rodar 24/7 | 🚀 Produção |

---

## 🎓 Dicas Pro

### 1. **Múltiplos Terminais**
```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Git commands
git status
git add .
git commit -m "..."

# Terminal 3: Testes de API
curl http://localhost:3000/api/...
```

### 2. **Auto-refresh no Browser**
- Use Chrome DevTools aberto (F12)
- Network tab para ver requests
- Console tab para ver logs
- React DevTools para inspecionar components

### 3. **VS Code Debugger**
Configure `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "attach",
      "port": 9229
    }
  ]
}
```

Depois:
```bash
NODE_OPTIONS='--inspect' npm run dev
```

---

## ✅ Resumo Final

**PODE desenvolver localmente?** → **SIM, 100%!**

**Vantagens:**
- ✅ 10x mais rápido para testar
- ✅ Debugging completo
- ✅ Não quebra produção
- ✅ Mesma experiência de produção

**Workflow Ideal:**
1. `npm run dev` (mantém rodando)
2. Desenvolve e testa localmente
3. Quando estiver pronto: `git push`
4. Vercel faz deploy automático
5. Testa em produção para garantir

**Tempo economizado:** 80-90% em ciclos de desenvolvimento! 🚀

---

**Última atualização:** 05 Jan 2026  
**Autor:** Sistema de Documentação Automática  
**Status:** ✅ Pronto para uso
