# 📸 Como Adicionar o Avatar do Jorge Marfetan

## Opção 1: Local (Desenvolvimento) - MAIS RÁPIDO

### 1. Salvar a imagem
Salve a imagem do avatar como:
```
/workspaces/automacao-dados-financeiros/public/avatars/jorge-marfetan.jpg
```

### 2. Atualizar o banco de dados
Execute no Supabase SQL Editor:
```sql
UPDATE users
SET avatar_url = '/avatars/jorge-marfetan.jpg'
WHERE email = 'jmarfetan@digitalsmiledesign.com';
```

### 3. Testar
Recarregue a página: http://localhost:3000/dashboard
O avatar deve aparecer no menu do usuário (canto inferior da sidebar).

---

## Opção 2: Supabase Storage (Produção)

### 1. Criar bucket no Supabase
1. Vá em: https://supabase.com/dashboard/project/rrzgawssbyfzbkmtcovz/storage/buckets
2. Click **"New Bucket"**
3. Nome: `avatars`
4. ☑️ Marque **"Public bucket"**
5. Click **"Create Bucket"**

### 2. Fazer upload da imagem
1. Click no bucket `avatars`
2. Click **"Upload File"**
3. Selecione a imagem do Jorge
4. Nomeie como: `jorge-marfetan.jpg`
5. Click **"Upload"**

### 3. Copiar URL pública
1. Click na imagem uploaded
2. Click **"Get URL"** ou **"Copy URL"**
3. A URL será algo como:
   ```
   https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/avatars/jorge-marfetan.jpg
   ```

### 4. Atualizar banco de dados
Execute no SQL Editor:
```sql
UPDATE users
SET avatar_url = 'https://rrzgawssbyfzbkmtcovz.supabase.co/storage/v1/object/public/avatars/jorge-marfetan.jpg'
WHERE email = 'jmarfetan@digitalsmiledesign.com';
```

---

## ✅ Verificação

Depois de atualizar, verifique:
```sql
SELECT name, email, avatar_url 
FROM users 
WHERE email = 'jmarfetan@digitalsmiledesign.com';
```

Deve retornar a URL do avatar.

---

## 🎨 O Avatar Aparece Onde?

- **Sidebar Footer**: Avatar circular no canto inferior esquerdo
- **Dropdown Menu**: Quando você clica no avatar
- **Header**: (se implementado no futuro)

---

## 🔧 Troubleshooting

### Avatar não aparece
1. Verifique se a URL está correta no banco
2. Verifique se a imagem existe em `public/avatars/`
3. Limpe cache do navegador (Ctrl+Shift+R)
4. Verifique console do navegador (F12) para erros

### Imagem quebrada (broken image)
- Verifique se o arquivo tem o nome correto
- Verifique permissões do bucket (deve ser público)
- Teste a URL diretamente no navegador

---

**Recomendação**: Use Opção 1 agora para desenvolvimento, depois migre para Opção 2 em produção.
