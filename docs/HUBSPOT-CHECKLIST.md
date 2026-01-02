# ✅ Checklist de Implementação HubSpot

## 📦 Desenvolvimento (Completo)

- [x] Instalar driver SQL Server (`mssql`)
- [x] Criar cliente SQL Server (`src/lib/sqlserver.ts`)
- [x] Criar API route `/api/hubspot/sync`
- [x] Criar página `/reports/hubspot`
- [x] Adicionar menu "HubSpot Deals"
- [x] Configurar `.env.local` local
- [x] Testar build (`npm run build`)
- [x] Commit e push para GitHub

## 🚀 Deploy (Em Andamento)

- [x] Push para branch `main` → **Deploy automático iniciado**
- [ ] **CRÍTICO:** Configurar variáveis no Vercel
  - [ ] `SQLSERVER_HOST`
  - [ ] `SQLSERVER_DATABASE`
  - [ ] `SQLSERVER_USER`
  - [ ] `SQLSERVER_PASSWORD`
- [ ] Aguardar deploy completar (2-5 minutos)
- [ ] Verificar logs de deploy no Vercel

## 🧪 Testes (Após Deploy)

- [ ] Acessar `/reports/hubspot` em produção
- [ ] Clicar em "Sincronizar"
- [ ] Verificar se dados aparecem na tabela
- [ ] Testar filtros (busca, status)
- [ ] Testar edição de linha
- [ ] Testar exclusão de linha
- [ ] Testar toggle de reconciliado
- [ ] Testar exportação CSV

## 🔧 Configuração Azure (Se Necessário)

- [ ] Verificar firewall do SQL Server
  - [ ] Portal Azure → SQL Server → Networking
  - [ ] Adicionar IPs do Vercel (ou "Allow Azure services")
- [ ] Verificar permissões do usuário
- [ ] Testar conexão do Vercel → Azure SQL

## 📊 Validação de Dados

- [ ] Verificar estrutura da tabela no SQL Server
  ```sql
  SELECT TABLE_NAME 
  FROM INFORMATION_SCHEMA.TABLES 
  WHERE TABLE_TYPE = 'BASE TABLE'
  ```
- [ ] Confirmar nome da tabela de deals
- [ ] Verificar campos disponíveis
- [ ] Ajustar query se necessário (linha 19 de `route.ts`)

## 🔐 Segurança

- [x] Credenciais NÃO commitadas no Git
- [x] `.env.local` no `.gitignore`
- [ ] Variáveis no Vercel configuradas
- [ ] Firewall do Azure configurado
- [ ] Acesso testado e funcionando

## 📚 Documentação

- [x] Guia principal: `docs/HUBSPOT-INTEGRATION.md`
- [x] Setup Vercel: `docs/VERCEL-ENV-SETUP.md`
- [x] Resumo completo: `docs/HUBSPOT-SETUP-COMPLETE.md`
- [x] Script automático: `scripts/setup-vercel-env.sh`

## 🎯 Links Rápidos

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Configurar Variáveis:** https://vercel.com/dsdpowerbitutorials/automacao-dados-financeiros/settings/environment-variables
- **Azure Portal:** https://portal.azure.com
- **Repositório GitHub:** https://github.com/DSDPowerBiTutorials/automacao-dados-financeiros

---

## 🚨 PRÓXIMA AÇÃO NECESSÁRIA

### Configurar Variáveis no Vercel (OBRIGATÓRIO)

**Tempo estimado:** 5 minutos

1. Acesse: https://vercel.com/dsdpowerbitutorials/automacao-dados-financeiros/settings/environment-variables

2. Adicione 4 variáveis (clique "Add New" para cada):
   - `SQLSERVER_HOST` = `datawarehouse-io-eur.database.windows.net`
   - `SQLSERVER_DATABASE` = `Jorge9660`
   - `SQLSERVER_USER` = `Jorge6368`
   - `SQLSERVER_PASSWORD` = `***REMOVED***`

3. Para cada variável, selecione **todos os ambientes** (Production, Preview, Development)

4. Clique em "Save"

5. Force um redeploy ou aguarde o próximo commit

---

## ✅ Status Atual

| Componente | Status |
|------------|--------|
| Código Implementado | ✅ 100% |
| Build Testado | ✅ Passou |
| Git Push | ✅ Enviado |
| Deploy Vercel | 🔄 Aguardando |
| **Variáveis Ambiente** | ⚠️ **PENDENTE** |
| Testes Produção | ⏳ Após vars |

---

**Atualizado em:** 2 Janeiro 2026  
**Branch:** main  
**Último commit:** d969ae2
