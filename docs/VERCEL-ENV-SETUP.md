# 🚀 Configurar Variáveis de Ambiente no Vercel

## ⚡ Acesso Rápido

**URL Direta:** https://vercel.com/dsdpowerbitutorials/automacao-dados-financeiros/settings/environment-variables

## 📝 Passos

### 1. Acessar Dashboard do Vercel

1. Vá para: https://vercel.com/dashboard
2. Selecione o projeto: `automacao-dados-financeiros`
3. Clique em **Settings** (na barra superior)
4. Clique em **Environment Variables** (menu lateral)

### 2. Adicionar Variáveis

Clique em **"Add New"** para cada variável abaixo:

#### Variável 1: SQLSERVER_HOST
- **Name:** `SQLSERVER_HOST`
- **Value:** `datawarehouse-io-eur.database.windows.net`
- **Environment:** Selecione todas (Production, Preview, Development)

#### Variável 2: SQLSERVER_DATABASE
- **Name:** `SQLSERVER_DATABASE`
- **Value:** `Jorge9660`
- **Environment:** Selecione todas (Production, Preview, Development)

#### Variável 3: SQLSERVER_USER
- **Name:** `SQLSERVER_USER`
- **Value:** `Jorge6368`
- **Environment:** Selecione todas (Production, Preview, Development)

#### Variável 4: SQLSERVER_PASSWORD
- **Name:** `SQLSERVER_PASSWORD`
- **Value:** `***REMOVED***`
- **Environment:** Selecione todas (Production, Preview, Development)

### 3. Salvar e Redeploy

Após adicionar todas as variáveis:

1. As variáveis serão aplicadas no próximo deploy
2. OU clique em **Deployments** → selecione o último deploy → clique no menu **⋯** → **"Redeploy"**

## ✅ Verificar Configuração

Após o deploy:

1. Acesse: https://seu-dominio.vercel.app/reports/hubspot
2. Clique em **"Sincronizar"**
3. Deve aparecer mensagem de sucesso com quantidade de deals importados

## 🔐 Segurança

✅ **Boas Práticas:**
- Variáveis só ficam visíveis no Vercel (não no código)
- Nunca commite credenciais no Git
- Use `.env.local` apenas para desenvolvimento local
- Rotacione senhas periodicamente

## 🐛 Troubleshooting

### Erro "SQLSERVER_HOST is not defined"

**Causa:** Variáveis não configuradas ou deploy antigo

**Solução:**
1. Verifique se as variáveis estão em: Settings → Environment Variables
2. Force um novo deploy:
   ```bash
   git commit --allow-empty -m "trigger redeploy"
   git push origin main
   ```

### Erro "Login failed for user"

**Causa:** Credenciais incorretas ou IP bloqueado

**Solução:**
1. Verifique se as credenciais estão corretas
2. No Azure Portal, adicione IP do Vercel ao firewall:
   - Portal Azure → SQL Server → Networking
   - Adicionar regra: "Vercel" com range 0.0.0.0 - 255.255.255.255 (se for teste)
   - Para produção, use IPs específicos do Vercel

### Timeout na Conexão

**Causa:** Firewall bloqueando conexão

**Solução:**
- Adicione IPs do Vercel no whitelist do Azure SQL Server
- Habilite "Allow Azure services" nas configurações do firewall

## 📞 Suporte

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Azure Portal:** https://portal.azure.com
- **Documentação:** /docs/HUBSPOT-INTEGRATION.md
