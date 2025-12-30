# 🎯 GUIA DEFINITIVO: Criar Jorge Marfetan (Admin)

## ⚠️ ANTES DE TUDO

**VOCÊ PRECISA TER EXECUTADO O `AUTH-SETUP.sql` NO SUPABASE!**

Se ainda não executou, pare aqui e siga: [PASSO-OBRIGATORIO.md](PASSO-OBRIGATORIO.md)

---

## 📋 Dados do Usuário

```
Nome:          Jorge Marfetan
Cargo:         Finance Controller
Email:         jmarfetan@digitalsmiledesign.com
Senha:         ***REMOVED***
Role:          admin (acesso total ao sistema)
Empresa:       GLOBAL
Departamento:  Finance
```

---

## 🚀 MÉTODO RECOMENDADO: Supabase Dashboard

### Passo 1: Criar usuário no Auth
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral → **Authentication** → **Users**
4. Clique em **"Add User"** (botão verde, canto superior direito)
5. Preencha o formulário:
   ```
   Email: jmarfetan@digitalsmiledesign.com
   Password: ***REMOVED***
   ☑️ Auto Confirm User (marque esta opção!)
   ```
6. Clique em **"Create User"**
7. 🔴 **ATENÇÃO**: Na lista de usuários, clique no usuário criado
8. 🔴 **COPIE O UUID** (exemplo: `550e8400-e29b-41d4-a716-446655440000`)

### Passo 2: Criar perfil na tabela users
1. Menu lateral → **SQL Editor**
2. Clique em **"New Query"**
3. Cole este SQL (substituindo `<UUID>` pelo UUID copiado):

```sql
INSERT INTO users (
  id, 
  email, 
  name, 
  role, 
  company_code, 
  department, 
  is_active
) VALUES (
  '<UUID_COPIADO_NO_PASSO_1>',
  'jmarfetan@digitalsmiledesign.com',
  'Jorge Marfetan',
  'admin',
  'GLOBAL',
  'Finance',
  true
);
```

4. Clique em **"Run"** (ou Ctrl+Enter)
5. Você deve ver: `Success. No rows returned`

### Passo 3: Verificar criação
Execute este SQL:
```sql
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  r.description as role_description,
  u.company_code,
  u.department,
  u.is_active,
  u.created_at
FROM users u
JOIN roles r ON u.role = r.role
WHERE u.email = 'jmarfetan@digitalsmiledesign.com';
```

Você deve ver uma linha com:
- Email: jmarfetan@digitalsmiledesign.com
- Name: Jorge Marfetan
- Role: admin
- Role Description: Administrator
- Company Code: GLOBAL
- Department: Finance
- Is Active: true

---

## ✅ TESTE DE LOGIN

### 1. Acesse a página de login
- URL: http://localhost:3000/login
- Ou em produção: https://seu-app.vercel.app/login

### 2. Faça login
```
Email: jmarfetan@digitalsmiledesign.com
Senha: ***REMOVED***
```

### 3. Clique em "Sign In"

### 4. Você deve ser redirecionado para: `/dashboard`

### 5. Verifique se tudo aparece:
- ✅ Cabeçalho com "Digital Smile Design Financial Hub"
- ✅ Texto: "Logged in as: Jorge Marfetan"
- ✅ Scope: "GLOBAL"
- ✅ 6 cards de overview (Payables, Receivables, etc.)
- ✅ 3 gráficos (Cash Flow, Expense, Vendor)
- ✅ Botões de ação rápida
- ✅ Sidebar lateral esquerda
- ✅ No rodapé da sidebar: Avatar "JM", badge vermelho "Admin"

### 6. Teste navegação
- Clique em sidebar → **Accounts Payable** → **Invoices**
- Você deve ver a página de faturas
- Clique em sidebar → **Reports** → Bankinter EUR
- Você deve ver o relatório

### 7. Teste sign out
- Clique no avatar "JM" no rodapé da sidebar
- Clique em **"Sign Out"**
- Você deve ser redirecionado para `/login`

---

## 🔧 MÉTODOS ALTERNATIVOS

### Método 2: Script Node.js

```bash
# Certifique-se que o servidor está rodando
npm run dev

# Em outro terminal:
node scripts/create-first-admin.js

# Digite 's' quando perguntado
```

⚠️ **Este método SÓ funciona se você executou o AUTH-SETUP.sql antes!**

### Método 3: API REST

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

### Método 4: SQL Completo

Use o arquivo: `docs/CREATE-FIRST-USER.sql`
(já inclui criação no auth.users + users)

---

## ❌ TROUBLESHOOTING

### Erro: "Invalid login credentials"
**Causa**: Usuário não foi criado corretamente no auth.users  
**Solução**: 
1. Vá no Supabase Dashboard → Authentication → Users
2. Verifique se o email existe
3. Se não existir, crie via Dashboard
4. Se existir mas não funciona, delete e crie novamente

### Erro: "relation 'users' does not exist"
**Causa**: AUTH-SETUP.sql não foi executado  
**Solução**: Execute o AUTH-SETUP.sql no SQL Editor do Supabase

### Erro: "duplicate key value violates unique constraint"
**Causa**: Usuário já existe  
**Solução**: 
```sql
-- Deletar usuário existente
DELETE FROM users WHERE email = 'jmarfetan@digitalsmiledesign.com';
-- Tentar criar novamente
```

### Erro: "User not authenticated" ao acessar dashboard
**Causa**: AuthContext não detectou login  
**Solução**: 
1. Abra DevTools (F12) → Console
2. Procure por erros em vermelho
3. Verifique se há erro no fetch da sessão
4. Limpe cache do navegador (Ctrl+Shift+Del)
5. Tente login novamente

### Dashboard aparece mas sem dados
**Causa**: RLS (Row Level Security) pode estar bloqueando  
**Solução**: 
```sql
-- Verificar se o usuário tem role correta
SELECT * FROM users WHERE email = 'jmarfetan@digitalsmiledesign.com';

-- Deve retornar: role = 'admin'
-- Se não for admin, atualize:
UPDATE users 
SET role = 'admin' 
WHERE email = 'jmarfetan@digitalsmiledesign.com';
```

---

## 🔒 SEGURANÇA PÓS-SETUP

Depois de confirmar que o login funciona:

### 1. Remover rota temporária
```bash
rm src/app/api/setup-admin/route.ts
```

### 2. Remover script de criação
```bash
rm scripts/create-first-admin.js
```

### 3. Commitar remoção
```bash
git add -A
git commit -m "chore: Remove temporary user creation scripts"
git push
```

---

## 📊 VERIFICAR AUDIT LOG

Depois do primeiro login, verifique o log de auditoria:

```sql
SELECT 
  al.action,
  al.resource_type,
  al.created_at,
  u.name as user_name,
  al.details
FROM audit_log al
JOIN users u ON al.user_id = u.id
WHERE u.email = 'jmarfetan@digitalsmiledesign.com'
ORDER BY al.created_at DESC
LIMIT 10;
```

Você deve ver:
- `user_created`: Quando o usuário foi criado
- `login`: Quando fez login pela primeira vez

---

## 🎯 PRÓXIMOS PASSOS

Agora que Jorge Marfetan está criado e funcionando:

### 1. Criar mais usuários
- Finance Managers para ES e US
- Analysts
- Viewers

### 2. Testar permissões
- Fazer login com cada role
- Verificar acesso a módulos restritos
- Testar RoleGuard funcionando

### 3. Configurar Email
- No Supabase Dashboard → Authentication → Settings
- Configure SMTP para reset de senha
- Configure templates de email

### 4. Habilitar 2FA (opcional)
- Supabase Dashboard → Authentication → Settings
- Habilitar "Phone Auth" ou "Time-based One-Time Password"

### 5. Implementar features adicionais
- [ ] Página de gerenciamento de usuários
- [ ] Reset de senha via email
- [ ] Perfil do usuário editável
- [ ] Upload de avatar
- [ ] Histórico de atividades do usuário

---

## 📞 SUPORTE

Se continuar com problemas após seguir este guia:

1. **Logs do Servidor**: Terminal com `npm run dev`
2. **Logs do Cliente**: F12 → Console no navegador
3. **Logs do Supabase**: Dashboard → Logs
4. **Documentação Completa**: `docs/AUTH-SYSTEM-GUIDE.md`
5. **Revisão de Setup**: `docs/AUTH-SETUP.sql`

---

**🎉 Sucesso! Jorge Marfetan agora tem acesso total ao sistema!**

**📌 Lembre-se**: Ele é **ADMIN** - pode ver e fazer tudo!
