# 🚨 Guia de Rollback - Sistema Multi-País

## Se algo der errado no deploy, siga estes passos:

---

## 🔴 ROLLBACK DO CÓDIGO (GitHub/Vercel)

### Opção 1: Rollback via Git (Recomendado)

```bash
# 1. Voltar para o backup
git reset --hard v1.0.0-multi-country-backup-20251226-085522

# 2. Forçar push (CUIDADO!)
git push origin main --force
```

### Opção 2: Rollback via Vercel Dashboard

1. Acesse: https://vercel.com/dashboard
2. Clique no seu projeto `automacao-dados-financeiros`
3. Vá em **Deployments**
4. Encontre o deploy ANTERIOR (antes do commit `ee06367`)
5. Clique nos **3 pontos** → **Promote to Production**

---

## 🔴 ROLLBACK DO BANCO DE DADOS (Supabase)

### Se você já executou o SQL e precisa reverter:

```sql
-- ============================================================================
-- SCRIPT DE ROLLBACK COMPLETO
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

BEGIN;

-- OPÇÃO 1: Remover tabela completamente (USE COM CUIDADO!)
-- Descomentar apenas se quiser DELETAR TUDO
-- DROP TABLE IF EXISTS public.invoices CASCADE;
-- RAISE NOTICE '❌ Tabela invoices REMOVIDA';

-- OPÇÃO 2: Reverter apenas constraints de scope (manter dados)
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_country_code_check;

ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_scope_check;

-- Adicionar constraints antigas (se existiam)
-- ALTER TABLE public.invoices 
-- ADD CONSTRAINT invoices_country_code_check 
-- CHECK (country_code IN ('ES', 'US', 'GLOBAL'));

-- ALTER TABLE public.invoices 
-- ADD CONSTRAINT invoices_scope_check 
-- CHECK (scope IN ('ES', 'US', 'GLOBAL'));

RAISE NOTICE '✅ Constraints removidas - tabela voltou ao estado anterior';

COMMIT;
```

---

## 🔴 ROLLBACK PARCIAL (Apenas desabilitar funcionalidade)

Se quiser manter o código novo mas desabilitar temporariamente:

### 1. Desabilitar seletor de país no sidebar:

Edite: `/src/components/custom/sidebar.tsx`

Comente as linhas 50-80 (bloco do country selector):

```typescript
{/* TEMPORARILY DISABLED
{!collapsed && (
  <div className="px-3 py-2">
    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
      Country / Region
    </div>
    <div className="flex gap-1">
      // ... resto do código
    </div>
  </div>
)}
*/}
```

### 2. Forçar scope padrão:

Edite: `/src/contexts/global-scope-context.tsx`

Linha 15, mude para:

```typescript
const [selectedScope, setSelectedScope] = useState<ScopeType>("ES"); // Sempre ES
```

---

## 📊 VERIFICAR ESTADO ATUAL

### Verificar versão do código:

```bash
git log --oneline -5
```

**Versão NOVA (multi-país):** commit `ee06367`  
**Versão BACKUP (anterior):** tag `v1.0.0-multi-country-backup-20251226-085522`

### Verificar estado do banco:

```sql
-- Verificar se tabela existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'invoices'
);

-- Ver constraints atuais
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%scope%' OR constraint_name LIKE '%country%';

-- Contar invoices por scope
SELECT scope, COUNT(*) 
FROM public.invoices 
GROUP BY scope;
```

---

## 🆘 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "MODULE_NOT_FOUND" ou erros de cache

**Solução:**
```bash
cd /workspaces/automacao-dados-financeiros
rm -rf .next
rm -rf node_modules
npm install
npm run dev
```

### Problema 2: Vercel não está fazendo deploy

**Verificar:**
1. GitHub Actions não está bloqueando (deve estar vazio)
2. Vercel está conectado ao branch `main`
3. Não há erros de build no Vercel dashboard

### Problema 3: Sidebar não mostra seletor de país

**Verificar:**
1. Sidebar está expandida (hover sobre ela)
2. GlobalScopeProvider está no layout.tsx
3. Cache do navegador (Ctrl+Shift+R para hard refresh)

### Problema 4: "new row violates security policy"

**Solução:**
Execute apenas esta parte do SQL:

```sql
-- Fix RLS policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.invoices;
CREATE POLICY "Enable insert for authenticated users" 
ON public.invoices FOR INSERT 
WITH CHECK (true);

GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO anon;
```

### Problema 5: Não consigo criar invoice em modo GLOBAL

**Isso é NORMAL!** GLOBAL é apenas visualização (ES+US juntos).  
Para criar, selecione 🇪🇸 ou 🇺🇸.

---

## 📞 CHECKLIST DE EMERGÊNCIA

Antes de fazer rollback, verifique:

- [ ] O erro é realmente do deploy novo? (verificar logs)
- [ ] Tentou hard refresh no navegador? (Ctrl+Shift+R)
- [ ] Limpou cache do Next.js? (`rm -rf .next`)
- [ ] O Supabase está acessível? (verificar dashboard)
- [ ] O Vercel fez deploy com sucesso? (verificar dashboard)

Se tudo acima foi verificado e ainda tem problemas:

1. **ROLLBACK DO CÓDIGO:** `git reset --hard v1.0.0-multi-country-backup-20251226-085522`
2. **ROLLBACK DO BANCO:** Execute SQL de rollback acima
3. **FORCE PUSH:** `git push origin main --force`
4. **AGUARDE:** Vercel vai fazer deploy automático da versão antiga

---

## ✅ COMO SABER SE ROLLBACK DEU CERTO

Após rollback, você deve ver:

1. ✅ Git log mostra commit ANTES de `ee06367`
2. ✅ Vercel dashboard mostra deploy anterior como "Production"
3. ✅ Site não mostra seletor de país no sidebar
4. ✅ Invoices funcionam normalmente (sem scope ES/US/GLOBAL)

---

## 📝 LOGS E CONTATO

**Git Tag do Backup:** `v1.0.0-multi-country-backup-20251226-085522`  
**Commit do Deploy:** `ee06367`  
**Data do Deploy:** 26/12/2025 08:55:22  

**Links Úteis:**
- GitHub: https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros
- Vercel: https://vercel.com/dashboard
- Supabase: https://supabase.com/dashboard

---

## 🎯 DEPOIS DO ROLLBACK

Se você fez rollback e tudo voltou ao normal, você pode:

1. Investigar o que causou o problema
2. Testar localmente antes de fazer deploy novamente
3. Fazer deploy gradual (apenas código, depois banco)
4. Pedir ajuda analisando logs específicos

**Lembre-se:** Sempre há o backup! Você nunca vai perder dados. 🛡️
