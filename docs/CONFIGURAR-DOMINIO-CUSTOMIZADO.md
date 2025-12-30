# 🔧 Configurar Domínio Customizado com Supabase

## ❌ Problema Identificado

**Sintoma**: Loading infinito quando acessa via `dsdfinancehub.com`, mas funciona via `*.vercel.app`

**Causa**: Supabase Auth não reconhece o domínio customizado nas URLs de redirect e cookies.

---

## ✅ SOLUÇÃO: Configurar Supabase para aceitar domínio customizado

### 1. Adicionar Site URL no Supabase

1. Acesse: https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/auth/url-configuration
2. Encontre **"Site URL"**
3. Altere de: `http://localhost:3000`
4. Para: `https://dsdfinancehub.com`
5. Click **"Save"**

---

### 2. Adicionar Redirect URLs

Na mesma página, em **"Redirect URLs"**, adicione:

```
https://dsdfinancehub.com/**
https://dsdfinancehub.com/auth/callback
https://dsdfinancehub.com/dashboard
https://dsdfinancehub.com/login
```

**Importante**: O `/**` permite todos os paths do domínio.

---

### 3. Verificar Domínios Permitidos

Em **"Additional Redirect URLs"** ou **"Allowed Domains"**, certifique-se que está listado:

```
dsdfinancehub.com
www.dsdfinancehub.com
*.vercel.app (para preview deploys)
localhost (para desenvolvimento)
```

---

### 4. Configurar CORS no Supabase (se necessário)

Se o problema persistir, vá em:
- **Settings** → **API**
- Em **"CORS Configuration"**, adicione:

```
https://dsdfinancehub.com
https://www.dsdfinancehub.com
```

---

### 5. Atualizar variáveis de ambiente no Vercel

1. Vá em: https://vercel.com/dashboard → seu projeto → **Settings** → **Environment Variables**

2. Adicione/verifique:

```bash
NEXT_PUBLIC_SITE_URL=https://dsdfinancehub.com
NEXT_PUBLIC_SUPABASE_URL=https://rrzgawssbyfzbkmtcovz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(sua key)
```

3. Marque para usar em: **Production**, **Preview**, **Development**

4. Click **"Save"**

5. **IMPORTANTE**: Redeploy o projeto:
   - Vá em **Deployments**
   - Click nos 3 pontinhos no último deployment
   - **"Redeploy"**

---

## 🧪 Testar a Correção

### Passo 1: Limpar cache
```bash
# No navegador:
1. Abra DevTools (F12)
2. Clique com botão direito no ícone de reload
3. Selecione "Empty Cache and Hard Reload"
```

### Passo 2: Testar login
1. Acesse: https://dsdfinancehub.com/login
2. Faça login com: `jmarfetan@digitalsmiledesign.com`
3. Deve redirecionar para: https://dsdfinancehub.com/dashboard
4. ✅ **SEM loading infinito**

### Passo 3: Testar navegação
1. Vá para: https://dsdfinancehub.com/reports/bankinter-eur
2. Depois: https://dsdfinancehub.com/accounts-payable/invoices
3. ✅ **Navegação fluida sem travar**

---

## 🔍 Debug (se ainda não funcionar)

### Verificar cookies no DevTools

1. Abra DevTools (F12) → **Application** → **Cookies**
2. Procure por: `sb-rrzgawssbyfzbkmtcovz-auth-token`
3. Verifique o **Domain**:
   - ✅ Deve ser: `.dsdfinancehub.com` ou `dsdfinancehub.com`
   - ❌ Se for: `.vercel.app` → cookies não vão funcionar

### Verificar console de erros

1. Abra DevTools (F12) → **Console**
2. Procure por erros tipo:
   - `CORS policy blocked`
   - `Invalid redirect URL`
   - `Auth session missing`

### Testar com URL completa

Se ainda não funcionar, teste adicionando parâmetro:
```
https://dsdfinancehub.com/login?return_to=/dashboard
```

---

## 📝 Resumo das Configurações

### No Supabase:
- ✅ Site URL: `https://dsdfinancehub.com`
- ✅ Redirect URLs: `https://dsdfinancehub.com/**`
- ✅ CORS: `https://dsdfinancehub.com`

### No Vercel:
- ✅ Domínio customizado configurado
- ✅ HTTPS ativo
- ✅ Environment variables corretas
- ✅ Redeploy após mudanças

### No código (já está correto):
- ✅ AuthGuard sem loops
- ✅ AuthContext sem navegação automática
- ✅ LoginForm com redirect explícito

---

## 🚨 IMPORTANTE

Depois de fazer as mudanças no Supabase:
1. **Aguarde 1-2 minutos** para propagar
2. **Limpe todos os cookies** do navegador
3. **Faça um hard refresh** (Ctrl+Shift+R)
4. **Teste login novamente**

---

## 📞 Se o problema persistir

Execute este script para debug:

```bash
curl -I https://dsdfinancehub.com/api/auth/callback
```

Deve retornar `200 OK` ou `307 Redirect`, não `404` ou `500`.

---

**🎯 A configuração mais importante**: Adicionar `https://dsdfinancehub.com/**` nas Redirect URLs do Supabase!
