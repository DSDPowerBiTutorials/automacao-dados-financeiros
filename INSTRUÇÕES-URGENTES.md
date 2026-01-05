# ⚡ INSTRUÇÕES URGENTES - SIGA NA ORDEM

## 🔴 PASSO 1: Criar Bucket do Avatar (2 minutos)

### Execute este SQL no Supabase AGORA:

1. Abra [Supabase Dashboard](https://supabase.com/dashboard)
2. Clique no seu projeto
3. Vá em **SQL Editor** (barra lateral esquerda)
4. **COPIE e COLE** este SQL do arquivo `CREATE-BUCKET-NOW.sql`:

```sql
-- 1. Criar bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-uploads', 'user-uploads', true, 2097152, 
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152;

-- 2. Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- 3. Criar políticas
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = 'avatars');

-- 4. Verificar
SELECT 'Bucket:' as item, COUNT(*) as count FROM storage.buckets WHERE name = 'user-uploads';
SELECT 'Políticas:' as item, COUNT(*) as count FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
```

5. Clique em **RUN** (ou Ctrl+Enter)

### ✅ Deve aparecer:
```
Bucket:     1
Políticas:  4
```

---

## 🔴 PASSO 2: Limpar Cache e Relogar (1 minuto)

1. **Feche TODAS as abas** do sistema
2. **Limpe o cache:**
   - Windows: Ctrl+Shift+Delete
   - Mac: Cmd+Shift+Delete
   - OU apenas: Ctrl+Shift+R (force refresh)
3. **Abra a aplicação novamente**
4. **Faça login**

---

## 🔴 PASSO 3: Testar Avatar (1 minuto)

1. Vá para `/profile`
2. Clique em "Upload Photo"
3. Selecione uma imagem
4. **Deve funcionar agora!** ✅

---

## 🔴 PASSO 4: Verificar Dados do HubSpot (3 minutos)

### Aguarde o deploy (2-3 minutos)
Vercel está fazendo deploy agora. Aguarde alguns minutos.

### Depois:
1. Vá para `/reports/hubspot`
2. **Abra o Console** do navegador (F12 > Console)
3. Clique em **"Sincronizar"**
4. **OLHE OS LOGS** - vai aparecer algo assim:

```
🔄 Iniciando sync do HubSpot...
📊 Resultado do sync: {success: true, count: 1000, ...}
✅ Sync completo: 1000 deals sincronizados
📊 ESTATÍSTICAS DO SYNC:
  Total: 1000
  Com email: 950 (95.0%)
  Com produto: 980 (98.0%)
  🛒 Com ecomm_order_number: 0 (0.0%)  ← ⚠️ SE FOR 0%, CAMPOS ESTÃO VAZIOS!
  🌐 Com website_order_id: 0 (0.0%)  ← ⚠️ SE FOR 0%, CAMPOS ESTÃO VAZIOS!
  Query usada: enriched
🔍 PRIMEIRO DEAL (Ahmed Hamada):
  Deal ID: 12037674126
  Nome: DSD R1 Miami X 2
  ip__ecomm_bridge__order_number: NULL  ← ⚠️ VAZIO!
  website_order_id: NULL  ← ⚠️ VAZIO!
  product_quantity: 2
⚠️ ATENÇÃO: Campo ip__ecomm_bridge__order_number está NULL no HubSpot SQL Server!
⚠️ ATENÇÃO: Campo website_order_id está NULL no HubSpot SQL Server!
```

---

## 📊 INTERPRETANDO OS RESULTADOS

### Se aparecer `0.0%` e `NULL`:
**CONFIRMADO:** Os campos **NÃO EXISTEM** no HubSpot SQL Server.

**Significado:**
- ❌ Os dados "e437d54" e "2831851" **NÃO estão** nesses campos
- ❌ Não adianta fazer mais sync
- ✅ Precisamos descobrir ONDE esses dados estão guardados

**Próximo passo:**
Me envie screenshot dos logs do console e me diga:
1. Onde você vê "e437d54" no HubSpot CRM?
2. Em qual campo/propriedade está?
3. Onde você vê "2831851" no HubSpot CRM?

---

### Se aparecer `> 0%` (ex: 50%):
**PARCIAL:** Alguns deals têm, outros não.

**Próximo passo:**
Verificar quais deals NÃO têm esses campos e preencher no HubSpot.

---

## ❓ RESUMO: O QUE FAZER AGORA

1. ✅ Executar SQL do bucket → Avatar vai funcionar
2. ✅ Limpar cache → Sem loading infinito
3. ⏳ Aguardar deploy (2-3 min)
4. ✅ Sincronizar HubSpot e ver logs
5. 📸 Me enviar screenshot dos logs
6. 🔍 Me dizer onde estão os dados no HubSpot CRM

**Tempo total: ~10 minutos**

---

## 🆘 SE ALGO NÃO FUNCIONAR

### Avatar ainda dá erro 500:
→ Verifique se o SQL foi executado com sucesso
→ Vá em Storage > Buckets e veja se "user-uploads" existe

### Loading infinito persiste:
→ Feche TODAS as abas
→ Ctrl+Shift+Delete (limpar cache)
→ Abra novamente

### Não vejo logs no console:
→ Aguarde mais 2 minutos (deploy ainda rodando)
→ Force refresh (Ctrl+Shift+R)
→ Tente sync novamente

---

## 🎯 RESULTADO ESPERADO

Depois de seguir todos os passos:
- ✅ Avatar funciona
- ✅ Sem loading infinito
- ✅ Logs mostram exatamente onde está o problema do HubSpot
- ✅ Sabemos o que fazer para corrigir os dados
