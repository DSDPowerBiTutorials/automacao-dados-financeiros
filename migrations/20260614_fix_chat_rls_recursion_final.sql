-- ============================================
-- FIX DEFINITIVO: Recursão infinita em channel_members
-- 
-- O problema: channels_select faz subquery em channel_members,
-- e channel_members_select faz subquery em channels → recursão.
-- 
-- Solução: Dropar TODAS as policies existentes nas 3 tabelas 
-- de chat e recriar com policies simples sem subqueries cruzadas.
-- ============================================

-- 1. DROPAR todas as policies existentes
DROP POLICY IF EXISTS "channels_select" ON channels;
DROP POLICY IF EXISTS "channels_insert" ON channels;
DROP POLICY IF EXISTS "channels_update" ON channels;
DROP POLICY IF EXISTS "auth_all_channels" ON channels;

DROP POLICY IF EXISTS "channel_members_select" ON channel_members;
DROP POLICY IF EXISTS "channel_members_insert" ON channel_members;
DROP POLICY IF EXISTS "auth_all_channel_members" ON channel_members;

DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "messages_update" ON messages;
DROP POLICY IF EXISTS "messages_delete" ON messages;
DROP POLICY IF EXISTS "auth_all_messages" ON messages;

-- 2. Garantir RLS habilitado
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 3. Policies simples SEM subqueries cruzadas

-- Channels: todos os autenticados podem ver e criar
CREATE POLICY "channels_select" ON channels
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "channels_insert" ON channels
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "channels_update" ON channels
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Channel Members: todos os autenticados podem ver e inserir
-- (SEM subquery em channels = sem recursão)
CREATE POLICY "channel_members_select" ON channel_members
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "channel_members_insert" ON channel_members
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Messages: todos os autenticados podem ver, criar editar e apagar as suas
CREATE POLICY "messages_select" ON messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "messages_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "messages_update" ON messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "messages_delete" ON messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

SELECT 'Chat RLS recursion fix applied!' AS status;
