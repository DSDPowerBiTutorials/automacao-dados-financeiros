# 🚀 Guia: Monitorar Deploy na Vercel

## Para quem não tem experiência técnica

---

## ⏰ TEMPO ESTIMADO
**2 minutos** (só observar!)

---

## 🎯 PASSO 1: Acessar Vercel Dashboard

1. Abra: https://vercel.com/dashboard
2. Faça login (se necessário)
3. Procure seu projeto: **automacao-dados-financeiros**
4. Clique nele

**📸 Deve parecer com isso:**
```
┌────────────────────────────────────────────┐
│  Vercel Dashboard                          │
│  ┌──────────────────────────────────────┐  │
│  │ automacao-dados-financeiros          │  │
│  │ ● Production                         │  │
│  │ Last deployed: 2 minutes ago         │  │
│  └──────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## 🎯 PASSO 2: Verificar Status do Deploy

Na tela do projeto, você vai ver:

### ✅ DEPLOY BEM-SUCEDIDO
```
┌─────────────────────────────────────────────────┐
│  Production Deployment                          │
│  ✓ Ready                                        │
│  ee06367 - feat: Multi-country scope system     │
│  Deployed 3 minutes ago                         │
│  Duration: 45s                                  │
└─────────────────────────────────────────────────┘
```

**Sinais de sucesso:**
- ✓ Check verde
- Status: "Ready"
- Link azul clicável para o site

### ⏳ DEPLOY EM ANDAMENTO
```
┌─────────────────────────────────────────────────┐
│  Production Deployment                          │
│  🔄 Building...                                 │
│  ee06367 - feat: Multi-country scope system     │
│  Started 1 minute ago                           │
│  Duration: 30s                                  │
└─────────────────────────────────────────────────┘
```

**O que fazer:**
- **AGUARDE!** Pode demorar 1-3 minutos
- Não feche a página
- Não faça outro push

### ❌ DEPLOY COM ERRO
```
┌─────────────────────────────────────────────────┐
│  Production Deployment                          │
│  ✗ Failed                                       │
│  ee06367 - feat: Multi-country scope system     │
│  Failed 2 minutes ago                           │
│  Duration: 1m 15s                               │
└─────────────────────────────────────────────────┘
```

**O que fazer:**
- Clique no deploy (vai abrir detalhes)
- Procure por logs de erro (geralmente em vermelho)
- Siga o `ROLLBACK-GUIDE.md`

---

## 🎯 PASSO 3: Ver Logs de Build

Se quiser ver o que está acontecendo:

1. Clique no deploy atual
2. Você vai ver 3 abas:
   - **Overview** (resumo)
   - **Building** (logs de compilação)
   - **Functions** (funções serverless)

3. Clique em **"Building"**

**📸 Logs de sucesso:**
```
> Building...
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (37/37)
✓ Finalizing page optimization

Route (app)                                              Size
┌ ○ /                                                 15.2 kB
├ ○ /accounts-payable/invoices                         119 kB
...

✓ Build completed in 1m 25s
```

**Mensagens normais (não são erros):**
- `NOTICE:` (avisos informativos)
- `Optimized...` (otimização de código)
- `Compiled successfully` (compilado com sucesso)

**Mensagens de erro:**
- `ERROR:` (erro crítico)
- `Failed to compile` (falha na compilação)
- `Module not found` (módulo não encontrado)

---

## 🎯 PASSO 4: Testar o Site em Produção

Após deploy com sucesso:

1. Clique no link do site (geralmente algo como `automacao-dados-financeiros.vercel.app`)
2. Vai abrir o site em uma nova aba
3. Faça login (se necessário)
4. Vá para: **Accounts Payable** → **Invoices**

### Testes Rápidos:

#### Teste 1: Sidebar com seletor de país
- [ ] Vejo 3 botões: 🇪🇸 🇺🇸 🌐
- [ ] Botões estão abaixo do logo
- [ ] Aparecem quando passo o mouse no sidebar

#### Teste 2: Modo Espanha (ES)
- [ ] Clico em 🇪🇸
- [ ] Botão fica azul/destacado
- [ ] Vejo apenas invoices da Espanha
- [ ] Botão "New Invoice" está habilitado

#### Teste 3: Modo Estados Unidos (US)
- [ ] Clico em 🇺🇸
- [ ] Botão fica azul/destacado
- [ ] Vejo apenas invoices dos EUA
- [ ] Botão "New Invoice" está habilitado

#### Teste 4: Modo Global
- [ ] Clico em 🌐
- [ ] Botão fica azul/destacado
- [ ] Vejo invoices de ES + US juntas
- [ ] Botão "New Invoice" está **DESABILITADO** (cinza)
- [ ] Aparece texto: "(Consolidated: ES + US - View Only)"

---

## 🎯 PASSO 5: Testar Criação de Invoice

### Criar Invoice em ES:

1. Clique em 🇪🇸
2. Clique **"New Invoice"**
3. Preencha os campos obrigatórios:
   - **Invoice Date:** (qualquer data)
   - **Benefit Date:** (qualquer data)
   - **Invoice Type:** INCURRED
   - **Entry Type:** (qualquer)
   - **Provider:** (selecione um)
   - **Financial Account:** (selecione um)
   - **Cost Center:** (selecione um)
   - **Cost Type:** (selecione um)
   - **Dep Cost Type:** (selecione um)
   - **Due Date:** (qualquer data)
   - **Schedule Date:** (qualquer data)
   - **Amount:** 100.00
   - **Currency:** EUR

4. Clique **"Save"**

**✅ SUCESSO SE:**
- Invoice aparece na lista
- Número da invoice: **ES-INV-202412-0001** (ou próximo número)
- Sem mensagens de erro

**❌ ERRO SE:**
- Mensagem "Could not find table"
- Mensagem "new row violates security policy"
- Campos obrigatórios não estão marcados como obrigatórios

### Criar Invoice em US:

Repita o processo acima, mas:
1. Clique em 🇺🇸 ANTES de clicar "New Invoice"
2. Use **USD** como moeda
3. Número deve ser: **US-INV-202412-0001**

---

## 🆘 PROBLEMAS COMUNS

### Problema 1: Deploy ficou "Building" por mais de 5 minutos
**Provável causa:** Vercel está com problema de infra  
**Solução:**
1. Aguarde mais 5 minutos
2. Recarregue a página do Vercel
3. Se continuar travado, faça rollback

### Problema 2: Deploy deu erro "Module not found"
**Provável causa:** Cache corrompido  
**Solução:**
```bash
# No terminal local:
cd /workspaces/automacao-dados-financeiros
rm -rf .next
rm -rf node_modules
npm install
git add -A
git commit -m "fix: clear cache"
git push origin main
```

### Problema 3: Site está online mas não vejo os botões de país
**Provável causa:** Cache do navegador  
**Solução:**
1. Faça hard refresh: **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac)
2. Ou abra em aba anônima: **Ctrl+Shift+N**
3. Aguarde 2 minutos (Vercel pode estar propagando)

### Problema 4: "Could not find table 'invoices'"
**Provável causa:** Você não executou o SQL no Supabase  
**Solução:**
1. Siga o guia `SUPABASE-DEPLOY-GUIDE.md`
2. Execute o SQL completo
3. Faça hard refresh no site

### Problema 5: Deploy deu erro e não sei o que fazer
**Solução de emergência:**
1. Abra `ROLLBACK-GUIDE.md`
2. Siga a seção "🔴 ROLLBACK DO CÓDIGO"
3. Site vai voltar à versão anterior
4. Nenhum dado será perdido

---

## 📊 ENTENDENDO OS TEMPOS

| Etapa | Tempo Esperado | O que está acontecendo |
|-------|----------------|------------------------|
| Queued | 0-30s | Aguardando início |
| Building | 1-3min | Compilando código |
| Deploying | 10-30s | Enviando para servidores |
| Ready | - | Site online! |

**Tempo total normal:** 2-4 minutos

---

## ✅ CHECKLIST DE DEPLOY BEM-SUCEDIDO

Marque ✅ ao confirmar cada item:

### No Vercel:
- [ ] Status: "Ready" com check verde
- [ ] Link do site está clicável
- [ ] Commit correto: `ee06367`
- [ ] Branch: `main`
- [ ] Sem mensagens de erro nos logs

### No Site:
- [ ] Site abre sem erro 500 ou 404
- [ ] Login funciona normalmente
- [ ] Sidebar mostra 3 botões (🇪🇸 🇺🇸 🌐)
- [ ] Consigo criar invoice em ES
- [ ] Consigo criar invoice em US
- [ ] GLOBAL mostra ES+US juntos
- [ ] GLOBAL não permite criar (botão desabilitado)

### 🎉 SE TODOS OS ✅ = DEPLOY PERFEITO!

---

## 📈 MONITORAMENTO CONTÍNUO

Após deploy, monitore por 24 horas:

### O que observar:
- ✅ Nenhum erro no console do navegador (F12)
- ✅ Todas as páginas carregam normalmente
- ✅ Não há lentidão excessiva
- ✅ Logs do Vercel não mostram erros

### Como verificar logs do Vercel:
1. Acesse: https://vercel.com/dashboard
2. Clique no projeto
3. Aba **"Functions"** → Ver logs em tempo real
4. Ou aba **"Analytics"** → Ver estatísticas

---

## 🔔 NOTIFICAÇÕES

Configure notificações do Vercel (opcional):

1. Vercel Dashboard → Settings
2. Notifications
3. Marque:
   - ✅ Deploy succeeded
   - ✅ Deploy failed
4. Email ou Slack

Assim você será avisado automaticamente!

---

## 📚 LINKS ÚTEIS

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repo:** https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros
- **Backup Tag:** v1.0.0-multi-country-backup-20251226-085522

---

## 🎓 ENTENDENDO O QUE ACONTECEU

Quando você fez `git push`:

1. **GitHub** recebeu o código novo
2. **Vercel** detectou mudança automática (webhook)
3. **Vercel** baixou o código
4. **Vercel** instalou dependências (`npm install`)
5. **Vercel** compilou o projeto (`npm run build`)
6. **Vercel** fez deploy nos servidores globais
7. **CDN** propagou para o mundo todo (30s-2min)
8. **Seu site** agora tem a nova versão!

**Tudo isso em ~3 minutos, automaticamente!** 🚀

---

**Última atualização:** 26/12/2025  
**Versão:** 1.0.0 (Multi-Country)  
**Commit:** ee06367
