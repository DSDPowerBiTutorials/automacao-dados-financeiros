'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Inbox,
    Check,
    CheckCheck,
    Trash2,
    MessageSquare,
    AlertCircle,
    CreditCard,
    FileText,
    Users,
    Settings,
    Archive,
    Filter,
    Bell,
    BellOff,
} from 'lucide-react';
import { useNotifications, type Notification, type NotificationType } from '@/contexts/notification-context';
import { UserAvatar } from '@/components/user-avatar';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const notificationLabels: Record<NotificationType, string> = {
    mention: 'Mentioned you',
    comment_reply: 'Replied to you',
    task_assigned: 'Assigned to you',
    payment_due: 'Payment due',
    reconciliation: 'Reconciliation update',
    invoice_approved: 'Invoice approved',
    invoice_rejected: 'Invoice rejected',
    system: 'System notification',
};

type FilterType = 'all' | 'unread' | NotificationType;

export default function InboxPage() {
    const router = useRouter();
    const {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
    } = useNotifications();
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

    const filteredNotifications = notifications.filter((n) => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'unread') return !n.is_read;
        return n.type === activeFilter;
    });

    // Group by date
    const groupedByDate = filteredNotifications.reduce<Record<string, Notification[]>>((acc, n) => {
        const dateKey = format(new Date(n.created_at), 'yyyy-MM-dd');
        const label = isToday(new Date(n.created_at))
            ? 'Today'
            : isYesterday(new Date(n.created_at))
                ? 'Yesterday'
                : format(new Date(n.created_at), "dd 'de' MMMM", { locale: ptBR });
        if (!acc[label]) acc[label] = [];
        acc[label].push(n);
        return acc;
    }, {});

    function isToday(date: Date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    function isYesterday(date: Date) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return date.toDateString() === yesterday.toDateString();
    }

    function handleNavigate(url: string) {
        router.push(url);
    }

    function NotificationRow({ notification }: { notification: Notification }) {
        const Icon = notificationIcons[notification.type];
        const color = notificationColors[notification.type];
        const label = notificationLabels[notification.type];
        const triggeredBy = notification.triggered_by_user;

        const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR,
        });

        return (
            <div
                className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-200 dark:border-gray-800/50 ${!notification.is_read
                    ? 'bg-blue-500/5 hover:bg-blue-500/10'
                    : 'hover:bg-white/5'
                    }`}
                onClick={() => {
                    if (!notification.is_read) markAsRead(notification.id);
                    if (notification.reference_url) handleNavigate(notification.reference_url);
                }}
            >
                {/* Unread indicator */}
                <div className="flex-shrink-0 pt-1.5">
                    {!notification.is_read ? (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                    ) : (
                        <div className="w-2 h-2" />
                    )}
                </div>

                {/* Avatar or icon */}
                <div className="flex-shrink-0">
                    {triggeredBy ? (
                        <UserAvatar
                            user={{ name: triggeredBy.name, avatar_url: triggeredBy.avatar_url }}
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

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color }}>
                            {label}
                        </span>
                        <span className="text-[10px] text-gray-600">{timeAgo}</span>
                    </div>
                    <p className={`text-sm mt-0.5 ${!notification.is_read ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                        {notification.title}
                    </p>
                    {notification.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                            {notification.message}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {!notification.is_read && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                            }}
                            className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-green-400 transition-colors"
                            title="Mark as read"
                        >
                            <Check className="h-3.5 w-3.5" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        );
    }

    const filterOptions: { key: FilterType; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'unread', label: `Unread (${unreadCount})` },
        { key: 'task_assigned', label: 'Task assigned' },
        { key: 'mention', label: 'Mentions' },
        { key: 'comment_reply', label: 'Replies' },
    ];

    return (
        <div className="h-full overflow-y-auto bg-white dark:bg-[#1e1f21]">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Inbox className="h-6 w-6" />
                            Inbox
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            {unreadCount > 0
                                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                                : 'All caught up!'
                            }
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-[#2a2b2d] hover:bg-gray-100 dark:hover:bg-[#333435] border border-gray-200 dark:border-gray-700 transition-colors"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                Mark all as read
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={() => {
                                    if (confirm('Clear all notifications?')) clearAllNotifications();
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-400 bg-gray-50 dark:bg-[#2a2b2d] hover:bg-gray-100 dark:hover:bg-[#333435] border border-gray-200 dark:border-gray-700 transition-colors"
                            >
                                <Archive className="h-3.5 w-3.5" />
                                Clear all
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 mb-4">
                    {filterOptions.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setActiveFilter(opt.key)}
                            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeFilter === opt.key
                                ? 'text-gray-900 dark:text-white border-blue-500'
                                : 'text-gray-500 border-transparent hover:text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Notification list */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin h-8 w-8 border-3 border-gray-300 dark:border-gray-600 border-t-blue-500 rounded-full" />
                    </div>
                ) : filteredNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <BellOff className="h-12 w-12 text-gray-700 mb-4" />
                        <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {activeFilter === 'unread' ? 'No unread notifications' : 'No notifications'}
                        </h2>
                        <p className="text-sm text-gray-600">
                            {activeFilter === 'unread'
                                ? "You're all caught up!"
                                : 'Notifications from tasks, comments, and assignments will appear here'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-[#2a2b2d] rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                        {Object.entries(groupedByDate).map(([dateLabel, notifs]) => (
                            <div key={dateLabel}>
                                <div className="px-4 py-2 bg-gray-100 dark:bg-[#252627] text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {dateLabel}
                                </div>
                                {notifs.map(n => (
                                    <NotificationRow key={n.id} notification={n} />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
