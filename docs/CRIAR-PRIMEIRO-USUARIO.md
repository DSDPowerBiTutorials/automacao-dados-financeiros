# 🚀 Guia: Criar Primeiro Usuário Admin

## 📋 Dados do Usuário

- **Nome**: Jorge Marfetan
- **Cargo**: Finance Controller
- **Email**: jmarfetan@digitalsmiledesign.com
- **Senha**: ***REMOVED***
- **Role**: admin (nível 100 - acesso total)
- **Empresa**: GLOBAL
- **Departamento**: Finance

---

## ⚡ MÉTODO 1: Script Node.js (MAIS FÁCIL)

### Passo 1: Certifique-se que o servidor está rodando
```bash
npm run dev
```

### Passo 2: Execute o script em outro terminal
```bash
node scripts/create-first-admin.js
```

### Passo 3: Confirme a criação
- O script mostrará os dados do usuário
- Digite 's' ou 'sim' para confirmar
- Aguarde a criação

### Passo 4: Faça login
- Acesse: http://localhost:3000/login
- Email: jmarfetan@digitalsmiledesign.com
- Senha: ***REMOVED***

---

## 🔧 MÉTODO 2: Via API (ALTERNATIVO)

Se o script Node.js não funcionar, use diretamente a API:

```bash
curl -X POST http://localhost:3000/api/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jmarfetan@digitalsmiledesign.com",
    "password": "***REMOVED***",
    "name": "Jorge Marfetan",
    "department": "Finance"
  }'
```

---

## 💾 MÉTODO 3: SQL Direto no Supabase (MANUAL)

### Opção A: Via Dashboard do Supabase

1. Vá para **Supabase Dashboard** → **Authentication** → **Users**
2. Clique em **"Add User"**
3. Preencha:
   - Email: jmarfetan@digitalsmiledesign.com
   - Password: ***REMOVED***
4. Clique em **"Create User"**
5. **Copie o UUID** gerado (exemplo: 550e8400-e29b-41d4-a716-446655440000)
6. Vá para **SQL Editor** e execute:

```sql
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_COPIADO_DO_PASSO_5>',
  'jmarfetan@digitalsmiledesign.com',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);
```

### Opção B: Script SQL Completo

1. Vá para **Supabase Dashboard** → **SQL Editor**
2. Abra o arquivo: `docs/CREATE-FIRST-USER.sql`
3. **Copie TODO o conteúdo**
4. **Cole no SQL Editor**
5. Clique em **"Run"** (Ctrl+Enter)
6. Verifique a mensagem de sucesso

---

## ✅ Verificação

Após criar o usuário, verifique se tudo está correto:

```sql
-- Verificar perfil do usuário
SELECT 
  id,
  email,
  name,
  role,
  company_code,
  department,
  is_active,
  created_at
FROM users
WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- Verificar no auth.users
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email = 'jmarfetan@digitalsmiledesign.com';
```

---

## 🔒 Teste de Login

1. Acesse: http://localhost:3000/login
2. Digite:
   - **Email**: jmarfetan@digitalsmiledesign.com
   - **Senha**: ***REMOVED***
3. Clique em **"Sign In"**
4. Você deve ser redirecionado para: http://localhost:3000/dashboard
5. Verifique:
   - ✅ Nome aparece no canto superior: "Jorge Marfetan"
   - ✅ Badge vermelho com "Admin"
   - ✅ Dashboard mostra 6 cards de overview
   - ✅ Gráficos são exibidos
   - ✅ Menu lateral está visível

---

## 🧹 Limpeza Pós-Setup

**IMPORTANTE**: Após criar o primeiro admin, por segurança:

### 1. Remover rota de API temporária
```bash
rm src/app/api/setup-admin/route.ts
```

### 2. Remover script de criação
```bash
rm scripts/create-first-admin.js
```

### 3. Ou proteger a rota (se quiser mantê-la)
Adicione autenticação forte na rota `/api/setup-admin`:
- Token secreto no header
- Verificação de IP
- Disable após primeiro uso

---

## 🎯 Próximos Passos

Depois de fazer login com sucesso:

### 1. Criar Mais Usuários
Use a interface admin (quando implementada) ou SQL:

```sql
-- Finance Manager para España
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_DO_AUTH_USERS>',
  'manager.es@digitalsmiledesign.com',
  'Manager España',
  'finance_manager',
  'ES',
  'Finance',
  true
);

-- Analyst para USA
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_DO_AUTH_USERS>',
  'analyst.us@digitalsmiledesign.com',
  'Analyst USA',
  'analyst',
  'US',
  'Operations',
  true
);

-- Viewer Global
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<UUID_DO_AUTH_USERS>',
  'viewer@digitalsmiledesign.com',
  'Viewer Global',
  'viewer',
  'GLOBAL',
  'Reports',
  true
);
```

### 2. Testar Permissões
- Faça login com cada role
- Tente acessar páginas restritas
- Verifique RoleGuard funcionando

### 3. Revisar Audit Log
```sql
SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 10;
```

### 4. Implementar Features Adicionais
- [ ] Página de gerenciamento de usuários
- [ ] Reset de senha
- [ ] 2FA
- [ ] OAuth (Google, Microsoft)

---

## ❓ Troubleshooting

### Erro: "Usuário já existe"
```sql
-- Deletar usuário existente
DELETE FROM users WHERE email = 'jmarfetan@digitalsmiledesign.com';
-- No Supabase Dashboard → Auth → Users → Deletar usuário
-- Depois tente criar novamente
```

### Erro: "Invalid login credentials"
- Verifique se o email está correto
- Verifique se a senha está correta
- Certifique-se que o usuário foi criado no auth.users
- Verifique se email_confirmed_at não é NULL

### Erro: "Middleware error" ou "Module not found"
- Já foi corrigido! Middleware está simplificado
- AuthGuard funciona no cliente
- Se persistir: `rm -rf .next && npm run dev`

### Dashboard não aparece após login
- Verifique se o usuário está na tabela users
- Verifique se role = 'admin'
- Verifique se is_active = true
- Abra console do navegador (F12) para ver erros

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do servidor: terminal com `npm run dev`
2. Verifique console do navegador: F12 → Console
3. Verifique Supabase logs: Dashboard → Logs
4. Revise a documentação: `docs/AUTH-SYSTEM-GUIDE.md`

---

**✨ Boa sorte com o setup!**
