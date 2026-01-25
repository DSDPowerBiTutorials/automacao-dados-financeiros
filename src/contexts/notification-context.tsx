"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './auth-context';

// Tipos de notificação
export type NotificationType =
    | 'mention'
    | 'comment_reply'
    | 'task_assigned'
    | 'payment_due'
    | 'reconciliation'
    | 'invoice_approved'
    | 'invoice_rejected'
    | 'system';

export interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    message: string | null;
    reference_type: string | null;
    reference_id: string | null;
    reference_url: string | null;
    metadata: Record<string, any>;
    triggered_by: string | null;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    updated_at: string;
    // Dados do usuário que gerou a notificação
    triggered_by_user?: {
        id: string;
        name: string;
        avatar_url: string | null;
    };
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    error: string | null;
    // Actions
    fetchNotifications: (limit?: number) => Promise<void>;
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;
    clearAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Buscar notificações
    const fetchNotifications = useCallback(async (limit: number = 50) => {
        if (!profile?.id) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('notifications')
                .select(`
                    *,
                    triggered_by_user:users!notifications_triggered_by_fkey(
                        id,
                        name,
                        avatar_url
                    )
                `)
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (fetchError) throw fetchError;

            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        } catch (err: any) {
            console.error('Erro ao buscar notificações:', err);
            setError(err.message || 'Erro ao carregar notificações');
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    // Marcar como lida
    const markAsRead = useCallback(async (notificationId: string) => {
        try {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', notificationId);

            if (updateError) throw updateError;

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err: any) {
            console.error('Erro ao marcar notificação como lida:', err);
        }
    }, []);

    // Marcar todas como lidas
    const markAllAsRead = useCallback(async () => {
        if (!profile?.id) return;

        try {
            const { error: updateError } = await supabase
                .from('notifications')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', profile.id)
                .eq('is_read', false);

            if (updateError) throw updateError;

            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch (err: any) {
            console.error('Erro ao marcar todas como lidas:', err);
        }
    }, [profile?.id]);

    // Deletar notificação
    const deleteNotification = useCallback(async (notificationId: string) => {
        try {
            const notification = notifications.find(n => n.id === notificationId);

            const { error: deleteError } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId);

            if (deleteError) throw deleteError;

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err: any) {
            console.error('Erro ao deletar notificação:', err);
        }
    }, [notifications]);

    // Limpar todas as notificações
    const clearAllNotifications = useCallback(async () => {
        if (!profile?.id) return;

        try {
            const { error: deleteError } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', profile.id);

            if (deleteError) throw deleteError;

            setNotifications([]);
            setUnreadCount(0);
        } catch (err: any) {
            console.error('Erro ao limpar notificações:', err);
        }
    }, [profile?.id]);

    // Carregar notificações quando o usuário logar
    useEffect(() => {
        if (profile?.id) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [profile?.id, fetchNotifications]);

    // Realtime subscription para novas notificações
    useEffect(() => {
        if (!profile?.id) return;

        const channel = supabase
            .channel('notifications-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${profile.id}`
                },
                async (payload) => {
                    // Buscar dados completos da nova notificação
                    const { data } = await supabase
                        .from('notifications')
                        .select(`
                            *,
                            triggered_by_user:users!notifications_triggered_by_fkey(
                                id,
                                name,
                                avatar_url
                            )
                        `)
                        .eq('id', payload.new.id)
                        .single();

                    if (data) {
                        setNotifications(prev => [data, ...prev]);
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,
                error,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                clearAllNotifications,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications deve ser usado dentro de NotificationProvider');
    }
    return context;
}
