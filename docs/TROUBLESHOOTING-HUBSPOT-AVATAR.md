# 🔍 TROUBLESHOOTING: HubSpot + Profile Issues

## ⚠️ PROBLEMA 1: Dados do HubSpot Ainda Errados

### Sintomas
Mesmo após limpar dados e fazer novo sync, os campos continuam errados:
- Order mostra "dsd r1" em vez de "e437d54"
- Reference mostra "#DSDESDSD R1" em vez de "#DSDESE437D54-2831851"
- Web Order ID mostra "-" (vazio)
- Quantity mostra "0" em vez de "2"

### Causa Raiz
**Os campos `ip__ecomm_bridge__order_number` e `website_order_id` estão VAZIOS no SQL Server do HubSpot.**

Isso significa que:
1. ✅ A query está correta
2. ✅ O código está funcionando
3. ❌ Os dados NÃO EXISTEM no HubSpot SQL Server

### Como Verificar

#### Passo 1: Olhar os logs do sync
1. Abra o console do navegador (F12 > Console)
2. Clique em "Sincronizar" na página do HubSpot
3. Procure por estas linhas nos logs:

```
🔍 DEBUG - Campos disponíveis no primeiro deal:
  - DealId: 12037674126
  - dealname: DSD R1 Miami X 2
  - ip__ecomm_bridge__order_number: null  ❌ (deveria ter valor)
  - website_order_id: null  ❌ (deveria ter valor)
  - product_quantity: 2  ✅
  - product_amount: 5950.00  ✅
```

```
🛒 0 deals com ecomm_order_number (0.0%)  ❌ (deveria ser maior que 0%)
🌐 0 deals com website_order_id (0.0%)  ❌ (deveria ser maior que 0%)
```

#### Passo 2: Verificar diretamente no SQL Server do HubSpot

Execute esta query **direto no SQL Server Management Studio** (SSMS):

```sql
SELECT TOP 10
  d.DealId,
  d.dealname,
  d.ip__ecomm_bridge__order_number,
  d.website_order_id,
  d.product_quantity,
  d.amount
FROM Deal d
LEFT JOIN LineItem li ON d.DealId = li.DealId
WHERE d.DealId = 12037674126 -- Ahmed Hamada's deal
```

**Resultado esperado:**
- Se `ip__ecomm_bridge__order_number` = NULL → Campo não está preenchido no HubSpot
- Se `website_order_id` = NULL → Campo não está preenchido no HubSpot

### Solução

#### Opção 1: Preencher os Campos no HubSpot (Recomendado)
Os campos precisam ser populados na fonte (HubSpot CRM):

1. **Acesse o HubSpot CRM**
2. **Encontre o deal** "DSD R1 Miami X 2" (Ahmed Hamada)
3. **Procure pelos campos:**
   - `IP Ecomm Bridge Order Number` → Preencher com "e437d54"
   - `Website Order ID` → Preencher com "2831851"
4. **Aguarde a sincronização** (pode levar alguns minutos)
5. **Faça novo sync** na aplicação

#### Opção 2: Extrair de Outro Campo
Se os dados existem em outro campo (ex: no `dealname`), podemos extrair:

**Exemplo de Extração do dealname:**
```typescript
// Se dealname = "DSD R1 Miami X 2" ou "#DSDESDSD R1"
// Extrair "R1" e buscar no banco de dados de orders
```

Posso implementar isso se você confirmar que os dados existem em outro lugar.

#### Opção 3: Mapear Manualmente (Temporário)
Criar uma tabela de mapeamento manual:

```sql
-- Criar tabela de mapeamento
CREATE TABLE hubspot_order_mapping (
    deal_id TEXT PRIMARY KEY,
    ecomm_order_number TEXT,
    website_order_id TEXT
);

-- Inserir mapeamentos conhecidos
INSERT INTO hubspot_order_mapping VALUES
('12037674126', 'e437d54', '2831851'),
-- ... outros deals
```

---

## ⚠️ PROBLEMA 2: Loading Infinito ao Fazer Upload de Avatar

### Sintomas
- Clica em "Upload Photo"
- Seleciona uma imagem
- Fica em loading infinito
- Avatar não é salvo

### Causa Raiz
**Bucket `user-uploads` não existe no Supabase Storage OU políticas RLS não foram criadas.**

### Como Verificar

#### Passo 1: Verificar os logs no console
Abra o console do navegador (F12 > Console) e procure por:

```
❌ Bucket "user-uploads" does not exist!
```

OU

```
❌ Error uploading file: new row violates row-level security policy
```

#### Passo 2: Verificar no Supabase Dashboard

1. Abra [Supabase Dashboard](https://supabase.com/dashboard)
2. Vá em **Storage** (barra lateral)
3. Procure pelo bucket **"user-uploads"**
   - ✅ Se existir: Problema são as políticas RLS
   - ❌ Se NÃO existir: Precisa criar o bucket

### Solução

#### Execute o SQL de Setup COMPLETO:

Vá em **Supabase SQL Editor** e execute:

```sql
-- =========================================
-- 1. CRIAR BUCKET
-- =========================================
DO $$ 
BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'user-uploads', 
        'user-uploads', 
        true,
        2097152, -- 2MB
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 2097152;
    
    RAISE NOTICE '✅ Bucket criado/atualizado';
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro: %', SQLERRM;
END $$;

-- =========================================
-- 2. REMOVER POLÍTICAS ANTIGAS
-- =========================================
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- =========================================
-- 3. CRIAR POLÍTICAS CORRETAS
-- =========================================
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

-- =========================================
-- 4. VERIFICAR SETUP
-- =========================================
SELECT 
    'Bucket existe:' as check_type,
    CASE WHEN COUNT(*) > 0 THEN '✅ SIM' ELSE '❌ NÃO' END as status
FROM storage.buckets WHERE name = 'user-uploads'
UNION ALL
SELECT 
    'Políticas criadas:' as check_type,
    CASE WHEN COUNT(*) >= 4 THEN '✅ SIM' ELSE '❌ NÃO' END as status
FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
```

**Resultado esperado:**
```
✅ Bucket criado/atualizado
✅ Bucket existe: SIM
✅ Políticas criadas: SIM
```

#### Depois de executar:
1. **Force refresh** da página (Ctrl+Shift+R)
2. **Tente fazer upload novamente**
3. **Deve funcionar agora!**

---

## 🧪 Testes Pós-Correção

### Teste 1: HubSpot Sync
```bash
# No console do navegador:
1. Vá para /reports/hubspot
2. Abra console (F12)
3. Clique em "Sincronizar"
4. Veja os logs:
   - Deve mostrar "🔍 DEBUG - Campos disponíveis no primeiro deal"
   - Verifique se ip__ecomm_bridge__order_number tem valor ou é null
```

### Teste 2: Upload de Avatar
```bash
# No console do navegador:
1. Vá para /profile
2. Abra console (F12)
3. Clique em "Upload Photo"
4. Selecione uma imagem
5. Veja os logs:
   - Deve mostrar "✅ Bucket exists, proceeding with upload"
   - Deve mostrar "✅ File uploaded successfully"
   - Avatar deve aparecer
```

---

## 📊 Checklist de Diagnóstico

### HubSpot
- [ ] Deletei dados antigos: `DELETE FROM csv_rows WHERE source = 'hubspot'`
- [ ] Fiz novo sync na aplicação
- [ ] Olhei os logs do console durante o sync
- [ ] Verifiquei se `ip__ecomm_bridge__order_number` retorna NULL
- [ ] Verifiquei se `website_order_id` retorna NULL
- [ ] Se NULLs: Campos precisam ser preenchidos no HubSpot CRM

### Avatar Upload
- [ ] Executei o SQL de setup completo (PROFILE-SETUP.sql)
- [ ] Verifiquei que bucket "user-uploads" existe
- [ ] Verifiquei que 4 políticas RLS foram criadas
- [ ] Dei force refresh na página (Ctrl+Shift+R)
- [ ] Testei upload novamente
- [ ] Avatar apareceu corretamente

---

## 🆘 Ainda Não Funcionou?

### HubSpot - Se ainda mostrar dados errados:
**É CONFIRMADO que os campos estão vazios no HubSpot SQL Server.**

Você precisa:
1. **Contatar administrador do HubSpot** para preencher os campos
2. **OU** implementar extração dos dados de outro campo (ex: dealname)
3. **OU** criar mapeamento manual temporário

### Avatar - Se ainda der loading infinito:
**Envie os logs do console:**
1. Abra console (F12)
2. Tente fazer upload
3. Copie TODOS os logs que aparecem
4. Envie para análise

---

## 📞 Contato de Suporte

Se precisar de ajuda:
1. **HubSpot**: Contate o administrador do HubSpot CRM
2. **Supabase**: Verifique se tem permissões de admin no projeto
3. **Código**: Abra issue no GitHub com os logs completos
