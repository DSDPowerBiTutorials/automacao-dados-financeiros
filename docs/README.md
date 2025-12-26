# 📚 Documentação - Sistema Multi-País

Bem-vindo à documentação do sistema de gestão financeira multi-país!

---

## 🚀 INÍCIO RÁPIDO

### Você acabou de fazer deploy?

**👉 COMECE AQUI:** [MASTER-DEPLOY-GUIDE.md](MASTER-DEPLOY-GUIDE.md)

Esse é o guia mestre com overview completo e checklist.

---

## 📖 GUIAS DISPONÍVEIS

### Para Deploy em Produção

| Guia | Tempo | Para Quem | Quando Usar |
|------|-------|-----------|-------------|
| [**MASTER-DEPLOY-GUIDE.md**](MASTER-DEPLOY-GUIDE.md) | 2min | Todos | **LEIA PRIMEIRO** - Overview completo |
| [**SUPABASE-DEPLOY-GUIDE.md**](SUPABASE-DEPLOY-GUIDE.md) | 5min | Leigos | Executar SQL no Supabase |
| [**VERCEL-MONITORING-GUIDE.md**](VERCEL-MONITORING-GUIDE.md) | 2min | Leigos | Monitorar deploy na Vercel |
| [**ROLLBACK-GUIDE.md**](ROLLBACK-GUIDE.md) | 5min | Emergências | Se algo der errado |

### Scripts SQL

| Arquivo | Propósito | Status |
|---------|-----------|--------|
| [**DEPLOY-PRODUCTION-COMPLETE.sql**](DEPLOY-PRODUCTION-COMPLETE.sql) | Script completo unificado | ✅ **USE ESTE** |
| [create-invoices-table.sql](create-invoices-table.sql) | Apenas criar tabela | Obsoleto (use o completo) |
| [fix-rls-policies.sql](fix-rls-policies.sql) | Apenas corrigir RLS | Obsoleto (use o completo) |
| [make-fields-required.sql](make-fields-required.sql) | Apenas campos obrigatórios | Obsoleto (use o completo) |
| [update-scope-constraints.sql](update-scope-constraints.sql) | Apenas constraints ES/US | Obsoleto (use o completo) |

---

## 🗺️ FLUXO DE DEPLOY

```
┌──────────────────────────────────────────────────────┐
│  1️⃣ LEIA: MASTER-DEPLOY-GUIDE.md                    │
│      ↓                                               │
│  2️⃣ EXECUTE: SUPABASE-DEPLOY-GUIDE.md              │
│      (copia/cola DEPLOY-PRODUCTION-COMPLETE.sql)    │
│      ↓                                               │
│  3️⃣ MONITORE: VERCEL-MONITORING-GUIDE.md           │
│      (aguarda deploy automático)                    │
│      ↓                                               │
│  ✅ SUCESSO!                                         │
│                                                      │
│  ❌ ERRO? → ROLLBACK-GUIDE.md                       │
└──────────────────────────────────────────────────────┘
```

---

## 📋 DOCUMENTAÇÃO TÉCNICA

### Arquitetura e Desenvolvimento

| Documento | Conteúdo |
|-----------|----------|
| [architecture.md](architecture.md) | Arquitetura do sistema |
| [codex-guidelines.md](codex-guidelines.md) | Guidelines de código |
| [supabase-guidelines.md](supabase-guidelines.md) | Padrões Supabase |
| [SUPABASE-TABLES.md](SUPABASE-TABLES.md) | Estrutura das tabelas |

### Features Específicas

| Documento | Conteúdo |
|-----------|----------|
| [SPLIT-INVOICE-FEATURE.md](SPLIT-INVOICE-FEATURE.md) | Sistema de divisão de invoices |
| [REBUILD-SUMMARY.md](REBUILD-SUMMARY.md) | Histórico de reconstruções |
| [VISUAL-GUIDE.md](VISUAL-GUIDE.md) | Guia visual do sistema |

### Utilitários

| Arquivo | Propósito |
|---------|-----------|
| [get_table_schema.sql](get_table_schema.sql) | Query para ver estrutura de tabelas |
| [migrate-to-multi-country.sql](migrate-to-multi-country.sql) | Migração para multi-país |

---

## 🎯 CASOS DE USO

### "Preciso fazer deploy em produção"
→ [MASTER-DEPLOY-GUIDE.md](MASTER-DEPLOY-GUIDE.md)

### "Como executo SQL no Supabase?"
→ [SUPABASE-DEPLOY-GUIDE.md](SUPABASE-DEPLOY-GUIDE.md)

### "Como sei se o Vercel terminou o deploy?"
→ [VERCEL-MONITORING-GUIDE.md](VERCEL-MONITORING-GUIDE.md)

### "Deu erro! Como reverter?"
→ [ROLLBACK-GUIDE.md](ROLLBACK-GUIDE.md)

### "Como funciona o sistema multi-país?"
→ [architecture.md](architecture.md) + [VISUAL-GUIDE.md](VISUAL-GUIDE.md)

### "Quais campos são obrigatórios na invoice?"
→ [SUPABASE-TABLES.md](SUPABASE-TABLES.md)

### "Como criar uma nova feature?"
→ [codex-guidelines.md](codex-guidelines.md)

---

## 🆘 TROUBLESHOOTING

### Problema: SQL deu erro no Supabase
**Ver:** [SUPABASE-DEPLOY-GUIDE.md](SUPABASE-DEPLOY-GUIDE.md) → seção "🆘 PRECISA DE AJUDA?"

### Problema: Vercel deploy falhou
**Ver:** [VERCEL-MONITORING-GUIDE.md](VERCEL-MONITORING-GUIDE.md) → seção "🆘 PROBLEMAS COMUNS"

### Problema: Código quebrou em produção
**Ver:** [ROLLBACK-GUIDE.md](ROLLBACK-GUIDE.md) → seção "🔴 ROLLBACK DO CÓDIGO"

### Problema: Banco de dados corrompido
**Ver:** [ROLLBACK-GUIDE.md](ROLLBACK-GUIDE.md) → seção "🔴 ROLLBACK DO BANCO"

---

## 📊 VERSÕES

### Atual
- **Versão:** 1.0.0 (Multi-Country)
- **Data:** 26/12/2025
- **Commit:** `ee06367`
- **Tag:** `v1.0.0-multi-country-backup-20251226-085522`

### Backups
```bash
# Ver todos os backups
git tag | grep backup

# Restaurar um backup específico
git reset --hard v1.0.0-multi-country-backup-20251226-085522
```

---

## 🔑 CONCEITOS IMPORTANTES

### Scopes (ES/US/GLOBAL)

- **ES (Spain/Espanha):** 🇪🇸
  - Moeda: EUR
  - Cria invoices: ES-INV-202412-0001
  - Pode criar e visualizar

- **US (United States):** 🇺🇸
  - Moeda: USD
  - Cria invoices: US-INV-202412-0001
  - Pode criar e visualizar

- **GLOBAL:** 🌐
  - Visualização consolidada (ES + US)
  - **NÃO PODE** criar invoices
  - Apenas leitura

### Campos Obrigatórios (Invoice)

1. Provider (Fornecedor)
2. Financial Account (Conta Financeira)
3. Cost Center (Centro de Custo)
4. Cost Type (Tipo de Custo)
5. Dep Cost Type (Tipo de Custo Dep)
6. Due Date (Data de Vencimento)
7. Schedule Date (Data Agendamento)

### Auto-Numeração

Formato: `{SCOPE}-INV-{YYYYMM}-{####}`

Exemplos:
- `ES-INV-202412-0001` (Espanha, Dezembro 2024)
- `US-INV-202412-0001` (Estados Unidos, Dezembro 2024)

---

## 🛠️ FERRAMENTAS

### Links Rápidos

- **GitHub:** https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros
- **Vercel:** https://vercel.com/dashboard
- **Supabase:** https://supabase.com/dashboard

### Comandos Úteis

```bash
# Ver status atual
git status

# Ver últimos commits
git log --oneline -10

# Ver tags de backup
git tag | grep backup

# Limpar cache do Next.js
rm -rf .next

# Reinstalar dependências
rm -rf node_modules && npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build
```

---

## 📝 CHANGELOG

### v1.0.0 (26/12/2025)
- ✅ Sistema multi-país (ES/US/GLOBAL)
- ✅ GlobalScopeContext implementado
- ✅ Sidebar com seletor de país
- ✅ GLOBAL como view-only
- ✅ Campos obrigatórios validados
- ✅ Auto-numeração por país
- ✅ RLS policies configuradas
- ✅ Constraints ES/US no banco

---

## 🎓 PARA DESENVOLVEDORES

Se você é desenvolvedor e quer entender o código:

1. Leia [architecture.md](architecture.md) primeiro
2. Depois [codex-guidelines.md](codex-guidelines.md)
3. Veja [SUPABASE-TABLES.md](SUPABASE-TABLES.md) para estrutura do banco
4. Entenda o fluxo em [VISUAL-GUIDE.md](VISUAL-GUIDE.md)

### Principais Arquivos de Código

```
src/
├── contexts/
│   └── global-scope-context.tsx      ← Estado global do scope
├── lib/
│   └── scope-utils.ts                ← Utilitários de scope
├── components/
│   └── custom/sidebar.tsx            ← Seletor de país
└── app/
    └── accounts-payable/
        └── invoices/page.tsx         ← Página principal
```

---

## 💡 DICAS

### Para Leigos
- ✅ Sempre leia o MASTER-DEPLOY-GUIDE primeiro
- ✅ Siga os passos na ordem exata
- ✅ Não pule seções
- ✅ Use Ctrl+F para procurar erros específicos

### Para Técnicos
- ✅ O SQL é idempotente (pode executar múltiplas vezes)
- ✅ GLOBAL nunca é gravado no banco (apenas UI)
- ✅ RLS policies são permissivas (true/true)
- ✅ Constraints garantem apenas ES/US no banco

---

## 📞 SUPORTE

### Encontrou um bug?
1. Verifique os guias de troubleshooting
2. Tente o rollback se necessário
3. Documente o erro (prints, logs)
4. Abra issue no GitHub com detalhes

### Precisa de nova feature?
1. Descreva o caso de uso
2. Veja se já existe algo similar
3. Consulte [codex-guidelines.md](codex-guidelines.md)
4. Implemente seguindo os padrões

---

## ✅ CHECKLIST DE INÍCIO

Antes de usar esta documentação:

- [ ] Tenho acesso ao GitHub (repo)
- [ ] Tenho acesso ao Vercel (deploy)
- [ ] Tenho acesso ao Supabase (banco)
- [ ] Sei usar Git básico (commit, push)
- [ ] Sei onde está o `ROLLBACK-GUIDE.md` (emergência)

### ✅ TODOS MARCADOS? VOCÊ ESTÁ PRONTO!

---

**Última atualização:** 26/12/2025  
**Mantido por:** Time de Desenvolvimento  
**Versão da documentação:** 1.0
