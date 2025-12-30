# ⚠️ PASSO OBRIGATÓRIO: Executar SQL no Supabase

Antes de criar o primeiro usuário, você **PRECISA** executar o script SQL no Supabase para criar as tabelas.

## 🎯 Passo a Passo RÁPIDO

### 1. Abra o Supabase Dashboard
- Acesse: https://supabase.com/dashboard
- Faça login
- Selecione seu projeto

### 2. Vá para o SQL Editor
- No menu lateral esquerdo, clique em **"SQL Editor"**
- Clique em **"New Query"**

### 3. Execute o AUTH-SETUP.sql
- Abra o arquivo: `/workspaces/automacao-dados-financeiros/docs/AUTH-SETUP.sql`
- **Selecione TUDO** (Ctrl+A)
- **Copie** (Ctrl+C)
- **Cole** no SQL Editor do Supabase (Ctrl+V)
- Clique em **"Run"** (ou Ctrl+Enter)

### 4. Aguarde a execução
- Você verá mensagens de sucesso
- Verifique se não há erros em vermelho
- As tabelas serão criadas: `roles`, `users`, `user_permissions`, `audit_log`

### 5. Verifique a criação
Execute este SQL para confirmar:
```sql
SELECT * FROM roles ORDER BY level DESC;
```

Você deve ver 4 roles:
- admin (level 100)
- finance_manager (level 50)
- analyst (level 10)
- viewer (level 1)

---

## ✅ Depois de Executar o SQL

### Opção 1: Criar via Supabase Dashboard (MAIS SEGURO)

1. No Supabase Dashboard, vá em **Authentication** → **Users**
2. Clique em **"Add User"**
3. Preencha:
   - Email: `jmarfetan@digitalsmiledesign.com`
   - Password: `***REMOVED***`
   - Auto-confirm: ✅ (marque esta opção)
4. Clique em **"Create User"**
5. **IMPORTANTE**: Copie o UUID do usuário criado

6. Vá para **SQL Editor** e execute:
```sql
INSERT INTO users (id, email, name, role, company_code, department, is_active)
VALUES (
  '<COLE_O_UUID_AQUI>',
  'jmarfetan@digitalsmiledesign.com',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);
```

### Opção 2: Script Automático (após SQL executado)

```bash
node scripts/create-first-admin.js
```

---

## 🧪 Teste Final

1. Acesse: http://localhost:3000/login
2. Login:
   - Email: `jmarfetan@digitalsmiledesign.com`
   - Senha: `***REMOVED***`
3. Você deve ver o dashboard!

---

## ❌ Se Encontrar Erros

### "relation 'roles' does not exist"
→ Você não executou o AUTH-SETUP.sql. Volte ao Passo 1.

### "relation 'users' does not exist"
→ Você não executou o AUTH-SETUP.sql. Volte ao Passo 1.

### "invalid_grant" ou "Invalid login credentials"
→ O usuário não foi criado no auth.users. Use o Dashboard do Supabase.

---

## 📝 Resumo dos Arquivos

- **docs/AUTH-SETUP.sql**: Script principal que DEVE ser executado primeiro
- **docs/CREATE-FIRST-USER.sql**: Script alternativo só para criar usuário
- **scripts/create-first-admin.js**: Script Node.js automático
- **src/app/api/setup-admin/route.ts**: API REST temporária

---

**🚀 Comece executando o AUTH-SETUP.sql no Supabase!**
