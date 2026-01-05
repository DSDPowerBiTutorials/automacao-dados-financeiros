# 🚀 GUIA RÁPIDO: Resolver Seus 2 Problemas

## 📋 PROBLEMA 1: HubSpot Dados Errados

### O que acontece:
Os campos `ip__ecomm_bridge__order_number` e `website_order_id` estão **VAZIOS** (NULL) no SQL Server do HubSpot.

### Como confirmar:
1. Abra a aplicação em `/reports/hubspot`
2. Abra o **Console do navegador** (F12 > Console)
3. Clique em **"Sincronizar"**
4. Procure por esta linha nos logs:

```
🔍 DEBUG - Campos disponíveis no primeiro deal:
  - ip__ecomm_bridge__order_number: null  ← ❌ SE FOR NULL, É O PROBLEMA
  - website_order_id: null  ← ❌ SE FOR NULL, É O PROBLEMA
```

### ✅ SOLUÇÃO:

**Opção A: Preencher no HubSpot CRM** (Recomendado)
1. Acesse o HubSpot CRM
2. Encontre o deal "DSD R1 Miami X 2" (Ahmed Hamada)
3. Preencha os campos:
   - `IP Ecomm Bridge Order Number` = "e437d54"
   - `Website Order ID` = "2831851"
4. Aguarde sync automático (ou force sync)
5. Volte na aplicação e clique em "Sincronizar"

**Opção B: Me diga onde os dados estão**
Se os dados existem em outro campo (ex: dentro do `dealname`), posso extrair automaticamente.

---

## 📋 PROBLEMA 2: Loading Infinito no Upload de Avatar

### O que acontece:
O bucket `user-uploads` não existe no Supabase Storage.

### ✅ SOLUÇÃO (5 minutos):

#### Passo 1: Abra o Supabase
Acesse [Supabase Dashboard](https://supabase.com/dashboard) → Seu projeto

#### Passo 2: Execute este SQL
Vá em **SQL Editor** (barra lateral) e cole este SQL:

```sql
-- Criar bucket
DO $$ 
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'user-uploads', 
        'user-uploads', 
        true,
        2097152,
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET public = true;
    RAISE NOTICE '✅ Bucket criado';
END $$;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Criar políticas
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
```

#### Passo 3: Clique em **RUN** (ou Ctrl+Enter)

Deve aparecer:
```
✅ Bucket criado
```

#### Passo 4: Teste
1. Volte para `/profile`
2. Force refresh (Ctrl+Shift+R)
3. Tente fazer upload novamente
4. **Deve funcionar agora!** 🎉

---

## 🔍 Verificação Final

### Para HubSpot:
Olhe os logs do console ao sincronizar. Se aparecer:
```
🛒 X deals com ecomm_order_number (X.X%)
🌐 X deals com website_order_id (X.X%)
```

- Se **0%** → Campos estão vazios no HubSpot, precisa preencher lá
- Se **> 0%** → Alguns deals têm, veja quais não têm

### Para Avatar:
Depois de executar o SQL, ao fazer upload você deve ver:
```
✅ Bucket exists, proceeding with upload
✅ File uploaded successfully
```

---

## ❓ Ainda Não Funcionou?

### HubSpot:
Se os campos continuam NULL, **me envie:**
1. Screenshot dos logs do console durante o sync
2. Me diga: onde estão os dados "e437d54" e "2831851" no HubSpot?

### Avatar:
Se ainda der erro, **me envie:**
1. Screenshot dos logs do console ao fazer upload
2. Screenshot da aba "Storage" no Supabase (mostrando se bucket existe)

---

## 📝 Resumo Rápido

| Problema | Causa | Solução |
|----------|-------|---------|
| HubSpot dados errados | Campos NULL no SQL Server | Preencher no HubSpot CRM |
| Avatar loading infinito | Bucket não existe | Executar SQL no Supabase |

**Tempo estimado:** 10 minutos para resolver ambos 🚀
