# Usuários Administradores

Este documento lista todos os usuários com permissões de administrador no sistema.

## Lista de Admins

### 1. Jorge Marfetan
- **Email:** jmarfetan@digitalsmiledesign.com
- **Role:** admin
- **Company Code:** GLOBAL
- **Department:** Finance
- **Status:** Ativo
- **Criado em:** 2024-12-30

### 2. Fernando
- **Email:** fernando@digitalsmiledesign.com
- **Role:** admin
- **Company Code:** GLOBAL
- **Department:** Finance
- **Status:** Ativo
- **Criado em:** 2026-01-08
- **User ID:** aeae50ee-40da-46c4-89b7-4789dcab3356

### 3. Sofia Hernandez
- **Email:** sofia@digitalsmiledesign.com
- **Role:** admin
- **Company Code:** GLOBAL
- **Department:** Finance
- **Status:** Ativo
- **Criado em:** 2026-01-21

## Como Criar Novos Admins

### Via API (Recomendado durante desenvolvimento)

```bash
curl -X POST http://localhost:3000/api/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@digitalsmiledesign.com",
    "password": "SenhaForte123!",
    "name": "Nome Completo",
    "department": "Finance"
  }'
```

### Via SQL (Produção)

Use o script em `docs/CREATE-FIRST-USER.sql` como template, modificando:
- Email
- Senha (será hasheada automaticamente)
- Nome
- Departamento

## Permissões Admin

Usuários com role `admin` têm acesso a:
- Todas as páginas do sistema
- Upload e processamento de CSVs
- Reconciliação de transações
- Gestão de master data
- Contas a Pagar e a Receber
- Dashboard executivo
- Relatórios e análises
- Configurações de integrações (Braintree, GoCardless, HubSpot, Pleo)

## Segurança

⚠️ **IMPORTANTE:** 
- Senhas devem ter no mínimo 8 caracteres
- Incluir letras maiúsculas, minúsculas, números e caracteres especiais
- Nunca compartilhar credenciais
- A API `/api/setup-admin` deve ser desabilitada em produção após setup inicial
