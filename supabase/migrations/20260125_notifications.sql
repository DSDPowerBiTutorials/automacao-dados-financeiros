-- =============================================================================
-- NOTIFICATIONS SYSTEM
-- Sistema de notificações para usuários (menções, alertas, etc.)
-- =============================================================================

-- Tabela principal de notificações
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Destinatário da notificação
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Tipo da notificação
    type TEXT NOT NULL CHECK (type IN (
        'mention',           -- Quando alguém menciona o usuário em um comentário
        'comment_reply',     -- Resposta a um comentário do usuário
        'task_assigned',     -- Tarefa atribuída ao usuário
        'payment_due',       -- Lembrete de pagamento
        'reconciliation',    -- Atualização de reconciliação
        'invoice_approved',  -- Fatura aprovada
        'invoice_rejected',  -- Fatura rejeitada
        'system'             -- Notificação do sistema
    )),
    
    -- Conteúdo
    title TEXT NOT NULL,
    message TEXT,
    
    -- Referência ao objeto relacionado (opcional)
    reference_type TEXT,  -- 'comment', 'invoice', 'payment', 'task', etc.
    reference_id UUID,    -- ID do objeto relacionado
    reference_url TEXT,   -- URL para navegação direta
    
    -- Metadados
    metadata JSONB DEFAULT '{}',
    
    -- Quem gerou a notificação (se aplicável)
    triggered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notifications_updated_at ON public.notifications;
CREATE TRIGGER notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver suas próprias notificações
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());

-- Usuários só podem atualizar suas próprias notificações (marcar como lida)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Qualquer usuário autenticado pode criar notificações
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Service role pode fazer tudo
DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
CREATE POLICY "Service role full access" ON public.notifications
    USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- FUNÇÃO PARA CRIAR NOTIFICAÇÃO DE MENÇÃO
-- =============================================================================

CREATE OR REPLACE FUNCTION create_mention_notification(
    p_mentioned_user_id UUID,
    p_triggered_by UUID,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_reference_url TEXT,
    p_context TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
    v_triggered_by_name TEXT;
BEGIN
    -- Buscar nome de quem mencionou
    SELECT name INTO v_triggered_by_name 
    FROM public.users 
    WHERE id = p_triggered_by;
    
    -- Não notificar se for auto-menção
    IF p_mentioned_user_id = p_triggered_by THEN
        RETURN NULL;
    END IF;
    
    -- Criar notificação
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        reference_url,
        triggered_by,
        metadata
    ) VALUES (
        p_mentioned_user_id,
        'mention',
        COALESCE(v_triggered_by_name, 'Alguém') || ' mencionou você',
        COALESCE(p_context, 'Você foi mencionado em um ' || COALESCE(p_reference_type, 'comentário')),
        p_reference_type,
        p_reference_id,
        p_reference_url,
        p_triggered_by,
        jsonb_build_object('triggered_by_name', v_triggered_by_name)
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- VIEW PARA CONTAGEM DE NOTIFICAÇÕES NÃO LIDAS
-- =============================================================================

CREATE OR REPLACE VIEW public.notification_counts AS
SELECT 
    user_id,
    COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
    COUNT(*) as total_count,
    MAX(created_at) as latest_notification_at
FROM public.notifications
GROUP BY user_id;

-- Grants
GRANT SELECT ON public.notification_counts TO authenticated;
GRANT ALL ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION create_mention_notification TO authenticated;

COMMENT ON TABLE public.notifications IS 'Sistema de notificações para usuários';
COMMENT ON FUNCTION create_mention_notification IS 'Cria uma notificação quando alguém menciona um usuário';
