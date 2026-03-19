"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
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

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { session, profile } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Track user IDs returned by the API for realtime filtering
    const userIdsRef = useRef<string[]>([]);

    const getAuthHeaders = useCallback(() => {
        const token = session?.access_token;
        if (!token) return null;
        return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    }, [session?.access_token]);

    const fetchNotifications = useCallback(async (limit: number = 50) => {
        const headers = getAuthHeaders();
        if (!headers) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/notifications?limit=${limit}`, { headers });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to fetch');

            const enriched = json.data || [];
            setNotifications(enriched);
            setUnreadCount(enriched.filter((n: Notification) => !n.is_read).length);
            // Store the resolved IDs for realtime filtering
            if (json.userIds) userIdsRef.current = json.userIds;
        } catch (err: any) {
            console.error('Erro ao buscar notificações:', err);
            setError(err.message || 'Erro ao carregar notificações');
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    // Marcar como lida
    const markAsRead = useCallback(async (notificationId: string) => {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ id: notificationId }),
            });

            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err: any) {
            console.error('Erro ao marcar notificação como lida:', err);
        }
    }, [getAuthHeaders]);

    // Marcar todas como lidas
    const markAllAsRead = useCallback(async () => {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ markAllRead: true }),
            });

            setNotifications(prev =>
                prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
            );
            setUnreadCount(0);
        } catch (err: any) {
            console.error('Erro ao marcar todas como lidas:', err);
        }
    }, [getAuthHeaders]);

    // Deletar notificação
    const deleteNotification = useCallback(async (notificationId: string) => {
        const headers = getAuthHeaders();
        if (!headers) return;

        const notification = notifications.find(n => n.id === notificationId);

        try {
            await fetch(`/api/notifications?id=${encodeURIComponent(notificationId)}`, {
                method: 'DELETE',
                headers,
            });

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            if (notification && !notification.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err: any) {
            console.error('Erro ao deletar notificação:', err);
        }
    }, [getAuthHeaders, notifications]);

    // Limpar todas as notificações
    const clearAllNotifications = useCallback(async () => {
        const headers = getAuthHeaders();
        if (!headers) return;

        try {
            await fetch('/api/notifications?all=true', {
                method: 'DELETE',
                headers,
            });

            setNotifications([]);
            setUnreadCount(0);
        } catch (err: any) {
            console.error('Erro ao limpar notificações:', err);
        }
    }, [getAuthHeaders]);

    // Carregar notificações quando o usuário logar
    useEffect(() => {
        if (session?.access_token && profile?.id) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [session?.access_token, profile?.id, fetchNotifications]);

    // Polling for new notifications
    useEffect(() => {
        if (!session?.access_token || !profile?.id) return;

        const interval = setInterval(() => {
            fetchNotifications();
        }, POLL_INTERVAL);

        return () => clearInterval(interval);
    }, [session?.access_token, profile?.id, fetchNotifications]);

    // Realtime subscription for instant notifications
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
                },
                (payload) => {
                    // Filter: only process if this notification is for us
                    const ids = userIdsRef.current;
                    if (ids.length > 0 && !ids.includes(payload.new.user_id)) return;

                    // Trigger a full refetch to get enriched data
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchNotifications]);

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
