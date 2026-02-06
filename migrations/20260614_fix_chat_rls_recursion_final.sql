-- ============================================
-- FIX DEFINITIVO v2: Recursão infinita em channel_members
-- 
-- O problema: policies nas tabelas channels / channel_members / messages
-- fazem subqueries cruzadas → recursão infinita.
-- 
-- Solução: Usar PL/pgSQL para dropar DINAMICAMENTE todas as policies
-- existentes nestas 3 tabelas (sem depender dos nomes) e recriar
-- policies simples sem subqueries cruzadas.
-- ============================================

-- ========== PASSO 1: DROPAR TODAS AS POLICIES EXISTENTES ==========
-- Usa pg_policies para encontrar TODAS (independente do nome)
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop ALL policies on channels
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'channels' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON channels', pol.policyname);
        RAISE NOTICE 'Dropped policy % on channels', pol.policyname;
    END LOOP;

    -- Drop ALL policies on channel_members
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'channel_members' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON channel_members', pol.policyname);
        RAISE NOTICE 'Dropped policy % on channel_members', pol.policyname;
    END LOOP;

    -- Drop ALL policies on messages
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON messages', pol.policyname);
        RAISE NOTICE 'Dropped policy % on messages', pol.policyname;
    END LOOP;

    -- Drop ALL policies on user_profiles (may also cause recursion)
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
        RAISE NOTICE 'Dropped policy % on user_profiles', pol.policyname;
    END LOOP;
END $$;

-- ========== PASSO 2: Garantir RLS habilitado ==========
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ========== PASSO 3: Policies simples SEM subqueries cruzadas ==========

-- Channels: todos os autenticados podem ver, criar, e editores podem editar
CREATE POLICY "channels_select" ON channels
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "channels_insert" ON channels
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "channels_update" ON channels
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "channels_delete" ON channels
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Channel Members: todos os autenticados — SEM subquery em channels
CREATE POLICY "channel_members_select" ON channel_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "channel_members_insert" ON channel_members
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "channel_members_update" ON channel_members
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "channel_members_delete" ON channel_members
  FOR DELETE TO authenticated USING (true);

-- Messages: todos vêem; só o autor pode inserir/editar/apagar
CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_update" ON messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- User Profiles: todos podem ver, só o próprio pode editar
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- ========== PASSO 4: Verificação ==========
SELECT tablename, policyname, cmd, permissive, qual
FROM pg_policies 
WHERE tablename IN ('channels', 'channel_members', 'messages', 'user_profiles')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
