"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Check, CheckCheck, Trash2, MessageSquare, AlertCircle, CreditCard, FileText, Users, Settings, ArrowLeft } from 'lucide-react';
import { useNotifications, type Notification, type NotificationType } from '@/contexts/notification-context';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
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
    mention: '#3b82f6',
    comment_reply: '#8b5cf6',
    task_assigned: '#10b981',
    payment_due: '#f59e0b',
    reconciliation: '#06b6d4',
    invoice_approved: '#22c55e',
    invoice_rejected: '#ef4444',
    system: '#6b7280',
};

// Labels por tipo
const notificationLabels: Record<NotificationType, string> = {
    mention: 'Menção',
    comment_reply: 'Resposta',
    task_assigned: 'Tarefa',
    payment_due: 'Pagamento',
    reconciliation: 'Reconciliação',
    invoice_approved: 'Fatura Aprovada',
    invoice_rejected: 'Fatura Rejeitada',
    system: 'Sistema',
};

function NotificationCard({
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
    const label = notificationLabels[notification.type];
    const triggeredBy = notification.triggered_by_user;

    const formattedDate = format(new Date(notification.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

    return (
        <Card
            className={`
                cursor-pointer transition-all hover:shadow-md
                ${!notification.is_read ? 'border-l-4 bg-blue-50/30' : 'border-l-4 border-l-transparent'}
            `}
            style={{ borderLeftColor: !notification.is_read ? color : 'transparent' }}
            onClick={() => {
                if (!notification.is_read) onMarkAsRead(notification.id);
                if (notification.reference_url) onNavigate(notification.reference_url);
            }}
        >
            <CardContent className="p-4">
                <div className="flex items-start gap-4">
                    {/* Avatar ou ícone */}
                    <div className="flex-shrink-0">
                        {triggeredBy ? (
                            <UserAvatar
                                user={{
                                    name: triggeredBy.name,
                                    avatar_url: triggeredBy.avatar_url
                                }}
                                size="md"
                            />
                        ) : (
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: `${color}20` }}
                            >
                                <Icon size={20} style={{ color }} />
                            </div>
                        )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: `${color}20`, color }}
                            >
                                {label}
                            </span>
                            {!notification.is_read && (
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                        </div>
                        <h3 className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                        </h3>
                        {notification.message && (
                            <p className="text-sm text-gray-500 mt-1">
                                {notification.message}
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">{formattedDate}</p>
                    </div>

                    {/* Ações */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                        {!notification.is_read && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
                                title="Marcar como lida"
                            >
                                <Check size={16} />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                            className="text-gray-500 hover:text-red-600"
                            title="Remover"
                        >
                            <Trash2 size={16} />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function NotificationsPage() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications
    } = useNotifications();

    useEffect(() => {
        fetchNotifications(100);
    }, [fetchNotifications]);

    const handleNavigate = (url: string) => {
        router.push(url);
    };

    return (
        <div className="container mx-auto py-6 px-4 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft size={18} className="mr-1" />
                        Voltar
                    </Button>
                    <div className="flex items-center gap-3">
                        <Mail size={24} className="text-gray-600" />
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
                            <p className="text-sm text-gray-500">
                                {unreadCount > 0
                                    ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
                                    : 'Todas lidas'
                                }
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAllAsRead()}
                        >
                            <CheckCheck size={16} className="mr-1" />
                            Marcar todas como lidas
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => clearAllNotifications()}
                        >
                            <Trash2 size={16} className="mr-1" />
                            Limpar todas
                        </Button>
                    )}
                </div>
            </div>

            {/* Lista */}
            <div className="space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
                    </div>
                ) : notifications.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Mail size={48} className="text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700">Nenhuma notificação</h3>
                            <p className="text-sm text-gray-500 mt-1">Você está em dia com tudo!</p>
                        </CardContent>
                    </Card>
                ) : (
                    notifications.map((notification) => (
                        <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onMarkAsRead={markAsRead}
                            onDelete={deleteNotification}
                            onNavigate={handleNavigate}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
