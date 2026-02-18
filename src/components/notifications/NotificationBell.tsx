"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, CheckCheck, Trash2, X, MessageSquare, AlertCircle, CreditCard, FileText, Users, Settings } from 'lucide-react';
import { useNotifications, type Notification, type NotificationType } from '@/contexts/notification-context';
import { UserAvatar } from '@/components/user-avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Ícones por tipo de notificação
const notificationIcons: Record<NotificationType, React.ElementType> = {
    mention: MessageSquare,
    comment_reply: MessageSquare,
    task_assigned: Users,
    payment_due: CreditCard,
    reconciliation: CheckCheck,
    invoice_approved: FileText,
    invoice_rejected: AlertCircle,
    system: Settings,
};

// Cores por tipo de notificação
const notificationColors: Record<NotificationType, string> = {
    mention: '#3b82f6',      // blue
    comment_reply: '#8b5cf6', // purple
    task_assigned: '#10b981', // green
    payment_due: '#f59e0b',   // amber
    reconciliation: '#06b6d4', // cyan
    invoice_approved: '#22c55e', // green
    invoice_rejected: '#ef4444', // red
    system: '#6b7280',        // gray
};

function NotificationItem({
    notification,
    onMarkAsRead,
    onDelete,
    onNavigate
}: {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
    onDelete: (id: string) => void;
    onNavigate: (url: string) => void;
}) {
    const Icon = notificationIcons[notification.type];
    const color = notificationColors[notification.type];
    const triggeredBy = notification.triggered_by_user;

    const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
        addSuffix: true,
        locale: ptBR
    });

    const handleClick = () => {
        if (!notification.is_read) {
            onMarkAsRead(notification.id);
        }
        if (notification.reference_url) {
            onNavigate(notification.reference_url);
        }
    };

    return (
        <div
            className={`
                group flex items-start gap-3 p-3 border-b border-gray-100 
                hover:bg-gray-50 cursor-pointer transition-colors
                ${!notification.is_read ? 'bg-blue-50/50' : ''}
            `}
            onClick={handleClick}
        >
            {/* Avatar ou ícone */}
            <div className="flex-shrink-0">
                {triggeredBy ? (
                    <UserAvatar
                        user={{
                            name: triggeredBy.name,
                            avatar_url: triggeredBy.avatar_url
                        }}
                        size="sm"
                    />
                ) : (
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${color}20` }}
                    >
                        <Icon size={16} style={{ color }} />
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                    </p>
                    {!notification.is_read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                </div>
                {notification.message && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{timeAgo}</p>
            </div>

            {/* Ações (aparecem no hover) */}
            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {!notification.is_read && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                        title="Marcar como lida"
                    >
                        <Check size={14} />
                    </button>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                    className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
                    title="Remover"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

export function NotificationBell() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications
    } = useNotifications();

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNavigate = (url: string) => {
        setIsOpen(false);
        router.push(url);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botão Mailbox */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-lg hover:bg-gray-100 dark:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Notificações"
            >
                <Mail size={20} className="text-gray-700 dark:text-gray-300" />

                {/* Badge de contagem */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
                    style={{ zIndex: 9999 }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                            <Mail size={18} className="text-gray-600" />
                            <h3 className="font-semibold text-gray-900">Notificações</h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full">
                                    {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                                    title="Marcar todas como lidas"
                                >
                                    <CheckCheck size={16} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Lista de notificações */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <Mail size={40} className="text-gray-700 dark:text-gray-300 mb-3" />
                                <p className="text-sm font-medium">Nenhuma notificação</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Você está em dia!</p>
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onNavigate={handleNavigate}
                                />
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
                            <button
                                onClick={() => { setIsOpen(false); router.push('/notifications'); }}
                                className="text-xs font-medium text-orange-600 hover:text-orange-700"
                            >
                                Ver todas
                            </button>
                            <button
                                onClick={() => clearAllNotifications()}
                                className="text-xs text-gray-500 hover:text-red-600"
                            >
                                Limpar todas
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
