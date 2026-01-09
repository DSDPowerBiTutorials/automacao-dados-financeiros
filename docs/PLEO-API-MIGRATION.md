# Pleo API - Análise e Migração da API Legacy

## 🚨 Problema Atual

A **API Legacy do Pleo foi descontinuada**. O token atual que você possui é exclusivo para a API Legacy e não funciona mais.

**Evidência:**
- Token válido até: 7 jan 2027
- Mensagem no Pleo Dashboard: *"Estes Tokens de API são exclusivamente para a API Legacy descontinuada"*
- Todos os endpoints retornam **404 Not Found**

## 📋 O que Descobrimos

### Endpoints Testados (Todos Falharam - 404)
```
https://external.pleo.io/v1/expenses
https://external.pleo.io/v1/transactions
https://external.pleo.io/v1/export
https://external.pleo.io/v1/spending
https://external.pleo.io/v2/expenses
https://api.pleo.io/v1/expenses
https://api.pleo.io/v2/expenses
```

### Por que Falhou?
❌ **API Legacy descontinuada** - Pleo migrou para nova arquitetura  
❌ **Token Legacy** - Não funciona com novos endpoints  
❌ **Sem acesso à nova API** - Interface atual não oferece opção de gerar novos tokens

## 🔍 Opções Disponíveis no Pleo Dashboard

Baseado nas capturas de tela fornecidas, o Pleo oferece:

### 1. Integrações SAML (Autenticação)
- Okta
- Microsoft Entra (Azure AD)
- Google Workspace
- Custom Setup

❌ **Não útil para nosso caso** - São para login/SSO, não para acesso a dados

### 2. Monitorização de Recibos
- Perk (integração para viagens)

❌ **Não útil para nosso caso** - Apenas adiciona dados de viagens

### 3. Gestão da Equipa
- Integrações de RH (AFAS, AlexisHR, BambooHR, etc.)

❌ **Não útil para nosso caso** - Para gestão de pessoas, não despesas

## ✅ SOLUÇÃO RECOMENDADA

### Opção 1: Exportação Manual + Upload CSV (IMEDIATO)

**Vantagens:**
- ✅ Funciona hoje
- ✅ Não depende de API
- ✅ Interface já existe no sistema

**Implementação:**
1. No Pleo Dashboard → Menu lateral → **"Exportar"**
2. Exportar despesas em CSV (formato: data, valor, comerciante, categoria, usuário)
3. Usar página de upload (vou criar uma específica para Pleo)
4. Sistema processa automaticamente e adiciona à tabela `csv_rows`

**Vou criar agora:**
- `/api/upload-pleo` - Endpoint para processar CSV do Pleo
- Upload automático com parser específico para formato Pleo

---

### Opção 2: Contatar Suporte Pleo (LONGO PRAZO)

**O que solicitar ao suporte:**

```
Assunto: Migração da API Legacy para Nova API

Mensagem:
Olá,

Temos uma integração ativa usando a API Legacy do Pleo 
(https://external.pleo.io/v1) que foi descontinuada.

Precisamos migrar para a nova API para continuar 
sincronizando despesas automaticamente.

Perguntas:
1. Qual é a nova base URL da API? (v2, v3?)
2. Como geramos um novo token (não Legacy)?
3. Há documentação disponível da nova API?
4. Endpoints disponíveis para buscar despesas/transações?
5. Rate limits e autenticação necessária?

Company ID: 8e5783c2-4f29-40f1-ad8f-770cd93e45aa
Email: [seu email]

Obrigado!
```

**Informações que precisamos:**
- ✅ Nova base URL da API
- ✅ Como gerar token da nova API
- ✅ Endpoints de despesas/transações
- ✅ Estrutura de resposta JSON
- ✅ Documentação técnica

---

### Opção 3: Webhooks do Pleo (IDEAL)

Se o Pleo oferecer webhooks, podemos receber notificações em tempo real:

**Fluxo:**
```
Despesa criada no Pleo → Webhook enviado → Nossa API processa → Salva no Supabase
```

**Verificar no Pleo Dashboard:**
- Settings → Integrations → Webhooks
- Ou contact suporte para habilitar

---

## 🛠️ O QUE FAZER AGORA

### Curto Prazo (Hoje)
**Vou implementar upload de CSV do Pleo:**
- ✅ Nova API route: `/api/upload-pleo`
- ✅ Parser para formato CSV do Pleo
- ✅ Botão de upload na página `/reports/pleo`
- ✅ Validação e transformação automática

**Você precisa:**
1. Exportar CSV do Pleo (Menu → Exportar)
2. Fazer upload na página Pleo Reports
3. Sistema processa automaticamente

### Médio Prazo (1-2 semanas)
- Contatar suporte Pleo
- Solicitar acesso à nova API
- Gerar novo token (não Legacy)
- Atualizar código com novos endpoints

### Longo Prazo (Ideal)
- Configurar webhooks (se disponível)
- Sincronização em tempo real
- Cron job diário como backup

---

## 📚 Recursos Úteis

### Links Importantes
- **Pleo Help Center:** https://help.pleo.io
- **Pleo Developer Portal (se existir):** https://developer.pleo.io
- **Suporte Pleo:** Via app ou email

### Documentação Antiga (Legacy - não funciona mais)
- Base URL: `https://external.pleo.io/v1`
- Token JWT: Válido mas apenas para API descontinuada
- Endpoints documentados mas inacessíveis

---

## 🔄 Status da Implementação

### ✅ O que está funcionando
- Página de relatório `/reports/pleo`
- Interface de listagem, edição, exclusão
- Filtros e busca
- Marcação de reconciliadas
- Exportação para CSV

### ❌ O que não está funcionando
- Sincronização automática via API (API Legacy descontinuada)
- Botão "Sincronizar Pleo" retorna erro 404

### 🚧 O que vou implementar agora
- Upload manual de CSV do Pleo
- Parser automático para formato Pleo
- Botão de upload na página

---

## 📞 Próximos Passos

**Opção A - Rápida (Recomendado para uso imediato):**
1. Aguarde eu implementar upload de CSV (5 minutos)
2. Exporte CSV do Pleo
3. Faça upload
4. Continue trabalhando normalmente

**Opção B - Completa (Para solução definitiva):**
1. Contate suporte Pleo
2. Solicite acesso nova API
3. Quando tiver: me informe endpoint e token
4. Atualizo código para usar nova API
5. Sincronização automática volta a funcionar

**Qual opção prefere?**
