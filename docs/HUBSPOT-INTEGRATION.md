# Integração HubSpot via SQL Server Data Warehouse

## 📋 Visão Geral

Esta implementação conecta o sistema Next.js diretamente ao **SQL Server Data Warehouse** que sincroniza dados do HubSpot automaticamente. Não é necessário usar a API do HubSpot diretamente.

## 🎯 Arquitetura

```
HubSpot → Data Warehouse Connector (SQL Server) → API Next.js → Supabase → Dashboard
                ↓
            Power BI
```

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Adicione no arquivo `.env.local` (nunca fazer commit deste arquivo!):

```bash
# SQL Server Data Warehouse (HubSpot Connector)
SQLSERVER_HOST=your_sqlserver_host.database.windows.net
SQLSERVER_DATABASE=your_database_name
SQLSERVER_USER=your_username
SQLSERVER_PASSWORD=your_secure_password
```

⚠️ **CRITICAL:** These credentials give access to your data warehouse. Keep them secure!

### 2. Configurar no Vercel

Para deploy em produção:

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `automacao-dados-financeiros`
3. Vá em **Settings** → **Environment Variables**
4. Adicione cada variável acima

## 🚀 Como Usar

### Sincronizar Dados

1. Acesse: `/reports/hubspot`
2. Clique em **"Sincronizar"**
3. O sistema irá:
   - Conectar no SQL Server
   - Buscar deals do HubSpot (últimos 6 meses)
   - Transformar para formato padronizado
   - Inserir no Supabase

### Estrutura de Dados

Os dados são armazenados na tabela `csv_rows` com:

- `source`: `'hubspot'`
- `date`: Data de fechamento do deal
- `description`: Nome do deal + empresa
- `amount`: Valor do deal
- `reconciled`: Status de conciliação
- `custom_data`: JSON com campos extras:
  - `deal_id`: ID do deal no HubSpot
  - `stage`: Estágio atual
  - `pipeline`: Pipeline do deal
  - `owner`: Dono do deal
  - `company`: Nome da empresa
  - `currency`: Moeda (EUR, USD, etc.)

## 🔧 Personalização

### Ajustar Query SQL

Edite o arquivo: `src/app/api/hubspot/sync/route.ts`

```typescript
const result = await pool.request().query(`
  SELECT 
    deal_id,
    deal_name,
    amount,
    close_date,
    stage,
    pipeline,
    owner_name,
    company_name,
    currency_code
  FROM deals
  WHERE close_date >= DATEADD(month, -6, GETDATE())
  ORDER BY close_date DESC
`);
```

**Nota:** As tabelas disponíveis dependem do seu conector. Consulte a documentação do Data Warehouse ou use:

```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
```

### Adicionar Mais Campos

No arquivo `src/app/api/hubspot/sync/route.ts`, adicione campos no `custom_data`:

```typescript
custom_data: {
  deal_id: deal.deal_id,
  stage: deal.stage,
  pipeline: deal.pipeline,
  owner: deal.owner_name,
  company: deal.company_name,
  currency: deal.currency_code || 'EUR',
  // Adicione aqui:
  probability: deal.probability,
  forecast_category: deal.forecast_category,
  // etc...
}
```

## 📊 Relatórios e Análise

### Dashboard

Estatísticas em tempo real:
- Total de deals
- Deals conciliados
- Deals pendentes
- Valor total
- Valor conciliado

### Filtros

- **Busca**: Por descrição, deal ID, empresa
- **Status**: Todos / Conciliados / Pendentes

### Exportação

Clique em **"Exportar"** para baixar CSV com todos os dados filtrados.

## 🔄 Automação (Opcional)

### Sincronização Agendada

Para sincronizar automaticamente, você pode:

1. **Usar Vercel Cron Jobs** (adicionar em `vercel.json`):

```json
{
  "crons": [{
    "path": "/api/hubspot/sync",
    "schedule": "0 0 * * *"
  }]
}
```

2. **Usar GitHub Actions** (criar `.github/workflows/hubspot-sync.yml`):

```yaml
name: HubSpot Sync
on:
  schedule:
    - cron: '0 0 * * *'  # Todo dia à meia-noite
  workflow_dispatch:  # Permite executar manualmente

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync HubSpot
        run: |
          curl -X POST ${{ secrets.VERCEL_URL }}/api/hubspot/sync
```

3. **Usar serviço externo** (UptimeRobot, cron-job.org, etc.)

## 🐛 Troubleshooting

### Erro de Conexão SQL Server

```
Error: Failed to connect to SQL Server
```

**Solução:**
- Verifique as variáveis de ambiente
- Certifique-se que o firewall do Azure permite seu IP
- Teste conexão com Azure Data Studio

### Timeout na Query

```
Error: Request timeout
```

**Solução:**
- Adicione filtros de data mais restritivos
- Use `TOP 1000` para limitar resultados
- Crie índices nas tabelas do SQL Server

### Dados Não Aparecem

**Verifique:**
1. Query SQL retorna resultados no SQL Server
2. Campos mapeados corretamente
3. Permissões do Supabase (RLS policies)

## 📚 Arquivos Criados

- `/src/lib/sqlserver.ts` - Cliente SQL Server
- `/src/app/api/hubspot/sync/route.ts` - API de sincronização
- `/src/app/reports/hubspot/page.tsx` - Página de relatório
- `/src/config/navigation.ts` - Adicionado menu HubSpot

## 🎉 Benefícios

✅ **Reutiliza conector existente** - Já está pago, maximize o ROI  
✅ **Sincronização confiável** - Data Warehouse já valida e normaliza dados  
✅ **Sem rate limits** - Não depende da API do HubSpot  
✅ **Mesma interface** - Integrado com outras fontes de dados  
✅ **Fácil manutenção** - Query SQL simples de ajustar  

## 🔐 Segurança

⚠️ **Importante:**
- Nunca commite credenciais no Git
- Use variáveis de ambiente em todos os ambientes
- Rotacione senhas periodicamente
- Configure IP whitelist no Azure SQL Server

## 📞 Suporte

Para questões sobre:
- **Estrutura de tabelas**: Consulte documentação do Data Warehouse Connector
- **Permissões SQL**: Contate administrador do Azure
- **Campos do HubSpot**: Verifique schema no Power BI ou SQL Server
