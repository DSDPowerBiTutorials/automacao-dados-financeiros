# 📘 Guia Passo-a-Passo: Deploy no Supabase

## Para quem não tem experiência técnica

---

## ⏰ TEMPO ESTIMADO
**5 minutos** (só copiar e colar!)

---

## 🎯 PASSO 1: Acessar Supabase

1. Abra seu navegador
2. Acesse: https://supabase.com/dashboard
3. Faça login (se não estiver logado)
4. Você vai ver uma lista de projetos

**📸 Deve parecer com isso:**
```
┌─────────────────────────────────────┐
│  Supabase Dashboard                 │
│  ┌───────────────┐                  │
│  │ Meus Projetos │                  │
│  │               │                  │
│  │ > Projeto 1   │ ← CLIQUE AQUI    │
│  │   Projeto 2   │                  │
│  └───────────────┘                  │
└─────────────────────────────────────┘
```

---

## 🎯 PASSO 2: Abrir SQL Editor

1. No menu lateral esquerdo, procure por **"SQL Editor"**
2. Clique nele
3. Você vai ver uma tela com um grande campo de texto branco

**📸 Deve parecer com isso:**
```
┌──────────────────────────────────────────────────────┐
│  SQL Editor                          [+ New Query]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  (Campo de texto grande e vazio)                     │
│  ← AQUI VOCÊ VAI COLAR O CÓDIGO                      │
│                                                      │
│                                                      │
│                                      [Run] [Clear]   │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 PASSO 3: Copiar o Script SQL

1. Abra o arquivo: `docs/DEPLOY-PRODUCTION-COMPLETE.sql`
2. Pressione **Ctrl+A** (selecionar tudo)
3. Pressione **Ctrl+C** (copiar)

**💡 DICA:** O arquivo tem aproximadamente 400 linhas. É normal!

---

## 🎯 PASSO 4: Colar no Supabase

1. Volte para o Supabase SQL Editor
2. Clique no campo de texto grande
3. Pressione **Ctrl+V** (colar)
4. O código vai aparecer no campo

**✅ VERIFICAÇÃO:** Você deve ver no topo:
```sql
-- ============================================================================
-- SCRIPT COMPLETO DE DEPLOY PARA PRODUÇÃO
-- Sistema Multi-País (ES/US/GLOBAL) - Invoices
```

---

## 🎯 PASSO 5: Executar o Script

1. Procure o botão **"Run"** (geralmente no canto inferior direito)
2. Clique nele
3. **AGUARDE!** Pode demorar 10-30 segundos

**⏳ ENQUANTO EXECUTA:**
```
┌────────────────────────────────────┐
│  Executing...                      │
│  🔄 Running SQL script             │
└────────────────────────────────────┘
```

---

## 🎯 PASSO 6: Verificar Sucesso

Após executar, você deve ver mensagens como:

```
NOTICE:  ✅ Tabela invoices criada ou já existe
NOTICE:  ✅ Índices criados
NOTICE:  ✅ Foreign key criada
NOTICE:  ✅ Trigger de auto-update criado
NOTICE:  ✅ RLS habilitado
NOTICE:  ✅ Políticas antigas removidas
NOTICE:  ✅ Políticas RLS criadas
NOTICE:  ✅ Permissões concedidas
NOTICE:  ✅ Valores NULL atualizados
NOTICE:  ✅ Nenhuma invoice com scope=GLOBAL encontrada
NOTICE:  ✅ Constraints de scope atualizadas (ES/US apenas)
NOTICE:  ✅ Comentários de documentação adicionados
NOTICE:  
NOTICE:  ═══════════════════════════════════════════════════════════════
NOTICE:  🎉 DEPLOY COMPLETO - VERIFICAÇÃO FINAL
NOTICE:  ═══════════════════════════════════════════════════════════════
NOTICE:  ✅ Tabela invoices: EXISTE
NOTICE:  ✅ Políticas RLS: 4 configuradas
NOTICE:  ✅ Índices: 7 criados
```

### ✅ SE VOCÊ VÊ ISSO = SUCESSO!

### ❌ SE DER ERRO

Se aparecer mensagem de erro (geralmente em vermelho):

1. **NÃO ENTRE EM PÂNICO!** 
2. Copie a mensagem de erro
3. Tire um print da tela
4. Siga o guia `ROLLBACK-GUIDE.md` (próximo arquivo)

**Erros comuns:**
- `"permission denied"` → Você não é admin do projeto
- `"relation already exists"` → Tabela já existe (OK, pode ignorar)
- `"syntax error"` → Você copiou só parte do código

---

## 🎯 PASSO 7: Verificar no Dashboard

Agora vamos confirmar que deu certo:

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver uma tabela chamada **"invoices"**
3. Clique nela

**📸 Deve parecer com isso:**
```
┌─────────────────────────────────────────────────┐
│  Table Editor                                   │
├─────────────────────────────────────────────────┤
│  Tables:                                        │
│  ┌──────────────┐                               │
│  │ > invoices   │ ← VOCÊ DEVE VER ISSO          │
│  │   providers  │                               │
│  │   csv_rows   │                               │
│  └──────────────┘                               │
└─────────────────────────────────────────────────┘
```

---

## 🎯 PASSO 8: Testar o Sistema

Agora vamos testar se está funcionando:

1. Abra seu site (URL da Vercel)
2. Vá para **Accounts Payable** → **Invoices**
3. No sidebar (barra lateral), você deve ver 3 botões:
   - 🇪🇸 (bandeira da Espanha)
   - 🇺🇸 (bandeira dos EUA)
   - 🌐 (globo)

### Teste 1: Criar Invoice em ES (Espanha)
1. Clique em 🇪🇸
2. Clique em **"New Invoice"**
3. Preencha os campos obrigatórios:
   - Provider
   - Financial Account
   - Cost Center
   - Cost Type
   - Dep Cost Type
   - Due Date
   - Schedule Date
4. Clique em **"Save"**
5. O número da invoice deve ser: **ES-INV-202412-0001**

### Teste 2: Criar Invoice em US (Estados Unidos)
1. Clique em 🇺🇸
2. Clique em **"New Invoice"**
3. Preencha os campos
4. O número deve ser: **US-INV-202412-0001**

### Teste 3: Visualização Global
1. Clique em 🌐
2. Você deve ver as 2 invoices criadas (ES + US)
3. O botão **"New Invoice"** deve estar **DESABILITADO** (cinza)
4. Isso é NORMAL! GLOBAL é só visualização.

---

## ✅ CHECKLIST FINAL

Marque ✅ cada item ao completar:

- [ ] Executei o SQL no Supabase sem erros
- [ ] Vi a mensagem "🎉 DEPLOY COMPLETO"
- [ ] Vejo a tabela "invoices" no Table Editor
- [ ] Vejo os 3 botões no sidebar (🇪🇸 🇺🇸 🌐)
- [ ] Consegui criar invoice em ES
- [ ] Consegui criar invoice em US
- [ ] GLOBAL mostra as 2 invoices juntas
- [ ] Botão "New Invoice" está desabilitado em GLOBAL

### 🎉 SE TODOS OS ✅ ESTÃO MARCADOS = SUCESSO TOTAL!

---

## 🆘 PRECISA DE AJUDA?

### Problema: Não vejo o SQL Editor no Supabase
**Solução:** Você pode não ser administrador do projeto. Peça acesso ao dono.

### Problema: SQL deu erro "permission denied"
**Solução:** Você precisa de permissões de admin. Peça ao dono do projeto.

### Problema: Não vejo os botões de país no site
**Solução:** 
1. Faça "hard refresh": Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
2. Espere 2 minutos (Vercel pode estar fazendo deploy)
3. Verifique se está na página /accounts-payable/invoices

### Problema: Deu erro ao criar invoice
**Solução:** 
1. Verifique se preencheu TODOS os campos obrigatórios
2. Se persistir, execute este SQL simples:

```sql
GRANT ALL ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO anon;
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **Rollback (se algo der errado):** Veja `ROLLBACK-GUIDE.md`
- **Arquitetura do sistema:** Veja `architecture.md`
- **Guidelines Supabase:** Veja `supabase-guidelines.md`

---

## 🎓 O QUE VOCÊ ACABOU DE FAZER

Parabéns! Você:

1. ✅ Criou uma tabela no banco de dados PostgreSQL
2. ✅ Configurou segurança (RLS policies)
3. ✅ Criou índices para performance
4. ✅ Implementou sistema multi-país (ES/US/GLOBAL)
5. ✅ Habilitou auto-numeração de invoices
6. ✅ Fez deploy em produção

**Nível de complexidade:** Isso normalmente requer um desenvolvedor senior!  
**Você conseguiu:** Em 5 minutos, seguindo instruções! 🚀

---

## 💾 BACKUP

**Lembre-se:** Se algo der muito errado, você tem um backup:

```bash
Tag: v1.0.0-multi-country-backup-20251226-085522
Commit: ee06367
Data: 26/12/2025 08:55:22
```

Siga o guia `ROLLBACK-GUIDE.md` para restaurar.

---

**Última atualização:** 26/12/2025  
**Versão do sistema:** 1.0.0 (Multi-Country)
