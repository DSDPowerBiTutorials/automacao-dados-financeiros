import { supabase } from './supabase';

export type CreateNotificationParams = {
    userId: string;
    type: 'mention' | 'comment_reply' | 'task_assigned' | 'payment_due' | 'reconciliation' | 'invoice_approved' | 'invoice_rejected' | 'system';
    title: string;
    message?: string;
    referenceType?: string;
    referenceId?: string;
    referenceUrl?: string;
    triggeredBy?: string;
    metadata?: Record<string, any>;
};

/**
 * Cria uma notificação para um usuário
 */
export async function createNotification(params: CreateNotificationParams): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: params.userId,
                type: params.type,
                title: params.title,
                message: params.message,
                reference_type: params.referenceType,
                reference_id: params.referenceId,
                reference_url: params.referenceUrl,
                triggered_by: params.triggeredBy,
                metadata: params.metadata || {},
            })
            .select('id')
            .single();

        if (error) throw error;

        return { success: true, id: data.id };
    } catch (err: any) {
        console.error('Erro ao criar notificação:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Cria notificações de menção (@usuario) a partir de um texto
 * Retorna os IDs dos usuários mencionados
 */
export async function createMentionNotifications(params: {
    text: string;
    triggeredBy: string;
    referenceType: string;
    referenceId: string;
    referenceUrl: string;
    contextMessage?: string;
}): Promise<{ mentionedUserIds: string[]; errors: string[] }> {
    const mentionedUserIds: string[] = [];
    const errors: string[] = [];

    // Regex para encontrar menções @nome ou @email
    const mentionRegex = /@(\w+(?:\.\w+)*(?:@\w+\.\w+)?)/g;
    const mentions = params.text.match(mentionRegex);

    if (!mentions || mentions.length === 0) {
        return { mentionedUserIds, errors };
    }

    // Remover duplicatas e o @
    const uniqueMentions = [...new Set(mentions.map(m => m.slice(1)))];

    for (const mention of uniqueMentions) {
        try {
            // Tentar encontrar usuário por email ou nome
            const { data: users, error: searchError } = await supabase
                .from('users')
                .select('id, name, email')
                .or(`email.ilike.%${mention}%,name.ilike.%${mention}%`)
                .limit(1);

            if (searchError) {
                errors.push(`Erro ao buscar usuário ${mention}: ${searchError.message}`);
                continue;
            }

            if (!users || users.length === 0) {
                continue; // Usuário não encontrado, ignorar
            }

            const user = users[0];

            // Não notificar auto-menção
            if (user.id === params.triggeredBy) {
                continue;
            }

            // Criar notificação
            const { data: notification, error: notifError } = await supabase
                .rpc('create_mention_notification', {
                    p_mentioned_user_id: user.id,
                    p_triggered_by: params.triggeredBy,
                    p_reference_type: params.referenceType,
                    p_reference_id: params.referenceId,
                    p_reference_url: params.referenceUrl,
                    p_context: params.contextMessage,
                });

            if (notifError) {
                errors.push(`Erro ao notificar ${user.name}: ${notifError.message}`);
            } else if (notification) {
                mentionedUserIds.push(user.id);
            }
        } catch (err: any) {
            errors.push(`Erro ao processar menção ${mention}: ${err.message}`);
        }
    }

    return { mentionedUserIds, errors };
}

/**
 * Notifica múltiplos usuários sobre um evento
 */
export async function notifyUsers(params: {
    userIds: string[];
    type: CreateNotificationParams['type'];
    title: string;
    message?: string;
    referenceType?: string;
    referenceId?: string;
    referenceUrl?: string;
    triggeredBy?: string;
}): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    const notifications = params.userIds.map(userId => ({
        user_id: userId,
        type: params.type,
        title: params.title,
        message: params.message,
        reference_type: params.referenceType,
        reference_id: params.referenceId,
        reference_url: params.referenceUrl,
        triggered_by: params.triggeredBy,
        metadata: {},
    }));

    const { error } = await supabase
        .from('notifications')
        .insert(notifications);

    if (error) {
        console.error('Erro ao criar notificações em lote:', error);
        failed = params.userIds.length;
    } else {
        success = params.userIds.length;
    }

    return { success, failed };
}
