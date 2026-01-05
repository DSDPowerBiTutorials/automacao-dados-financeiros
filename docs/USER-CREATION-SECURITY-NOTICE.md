# ⚠️ AVISO DE SEGURANÇA - Criação de Usuários

## �� Credenciais Removidas

Por questões de segurança, **TODAS as senhas e credenciais foram removidas** dos guias de criação de usuários.

## ✅ Como Criar Usuários Agora

### Método 1: Supabase Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu: **Authentication** → **Users**
4. Clique em **"Add User"**
5. Preencha email e **crie uma senha forte**
6. Marque "Auto Confirm User"
7. Copie o UUID do usuário criado
8. No SQL Editor, insira na tabela `users`:

```sql
INSERT INTO users (id, email, name, role_id, department, is_active)
SELECT 
  '<UUID_COPIADO>',
  'email@domain.com',
  'Nome do Usuário',
  (SELECT id FROM roles WHERE name = 'admin'), -- ou outro role
  'Finance',
  true;
```

### Método 2: Script Node.js

```bash
# O script pedirá a senha de forma interativa (não será logada)
node scripts/create-first-admin.js
```

### Método 3: API Endpoint

```bash
curl -X POST http://localhost:3000/api/setup-admin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@domain.com",
    "password": "<SUA_SENHA_FORTE_AQUI>",
    "name": "Nome do Usuário",
    "department": "Finance"
  }'
```

## 🚨 Regras de Segurança

1. **NUNCA** commite senhas em arquivos
2. **SEMPRE** use senhas fortes (mínimo 12 caracteres, maiúsculas, minúsculas, números, símbolos)
3. **SEMPRE** mude senhas padrão imediatamente após primeiro login
4. **NUNCA** compartilhe senhas via email, Slack, ou documentação
5. Use um **gerenciador de senhas** para armazenar credenciais

## 📝 Documentos Arquivados

Os seguintes documentos continham senhas expostas e foram **substituídos por este guia**:
- `CRIAR-PRIMEIRO-USUARIO.md` 
- `PASSO-OBRIGATORIO.md`
- `CRIAR-JORGE-MARFETAN.md`

Se precisar do processo técnico (sem credenciais), consulte `AUTH-SYSTEM-GUIDE.md`.
