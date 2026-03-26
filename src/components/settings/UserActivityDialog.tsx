'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import {
    LogIn,
    LogOut,
    FileEdit,
    Trash2,
    Download,
    Upload,
    RefreshCw,
    Bot,
    Activity,
    Loader2,
    Clock,
    Shield,
} from 'lucide-react'

interface ActivityLog {
    id: string
    action: string
    entity_type: string
    entity_name?: string
    ip_address?: string
    created_at: string
    metadata?: Record<string, unknown>
}

interface UserActivityData {
    user: {
        id: string
        email: string
        name: string
        role: string
        last_login_at?: string
        created_at: string
    }
    logs: ActivityLog[]
    stats: {
        loginCount: number
        totalActions: number
        lastAction: { action: string; date: string } | null
    }
}

interface UserActivityDialogProps {
    userId: string | null
    userName: string
    userEmail: string
    open: boolean
    onOpenChange: (open: boolean) => void
    accessToken?: string
}

const actionIcons: Record<string, React.ReactNode> = {
    login: <LogIn className="h-4 w-4 text-purple-500" />,
    logout: <LogOut className="h-4 w-4 text-gray-500" />,
    create: <FileEdit className="h-4 w-4 text-green-500" />,
    update: <FileEdit className="h-4 w-4 text-blue-500" />,
    delete: <Trash2 className="h-4 w-4 text-red-500" />,
    export: <Download className="h-4 w-4 text-yellow-500" />,
    import: <Upload className="h-4 w-4 text-cyan-500" />,
    sync: <RefreshCw className="h-4 w-4 text-indigo-500" />,
    bot_task: <Bot className="h-4 w-4 text-blue-500" />,
}

const actionLabels: Record<string, string> = {
    login: 'Login',
    logout: 'Logout',
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    export: 'Exported',
    import: 'Imported',
    sync: 'Synced',
    reconcile: 'Reconciled',
    bot_task: 'Bot Task',
}

export function UserActivityDialog({
    userId,
    userName,
    userEmail,
    open,
    onOpenChange,
    accessToken,
}: UserActivityDialogProps) {
    const [data, setData] = useState<UserActivityData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function loadActivity() {
        if (!userId || !accessToken) return
        setLoading(true)
        setError(null)

        try {
            const res = await fetch(`/api/auth/user-activity?userId=${encodeURIComponent(userId)}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to load activity')
            }
            const result = await res.json()
            setData(result)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error')
        } finally {
            setLoading(false)
        }
    }

    // Load activity when dialog opens (controlled mode: onOpenChange is NOT called when open prop changes)
    useEffect(() => {
        if (open && userId && accessToken) {
            loadActivity()
        }
        if (!open) {
            setData(null)
            setError(null)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, userId])

    function handleOpenChange(isOpen: boolean) {
        onOpenChange(isOpen)
    }

    function formatDate(date: string) {
        return new Date(date).toLocaleString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    function formatRelative(date: string) {
        const diff = Date.now() - new Date(date).getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        if (hours < 1) return 'Less than 1 hour ago'
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        if (days < 30) return `${days}d ago`
        return formatDate(date)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <UserAvatar user={{ email: userEmail, name: userName }} size="sm" />
                        <div>
                            <div>{userName}</div>
                            <div className="text-sm font-normal text-muted-foreground">{userEmail}</div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}

                {error && (
                    <div className="text-center py-8 text-red-500">
                        {error}
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-4 overflow-y-auto pr-2">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-purple-600">{data.stats.loginCount}</div>
                                <div className="text-xs text-muted-foreground">Logins</div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-blue-600">{data.stats.totalActions}</div>
                                <div className="text-xs text-muted-foreground">Total Actions</div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-green-600">
                                    {data.user.last_login_at ? formatRelative(data.user.last_login_at) : 'Never'}
                                </div>
                                <div className="text-xs text-muted-foreground">Last Login</div>
                            </div>
                        </div>

                        {/* User info */}
                        <div className="flex items-center gap-4 text-sm border rounded-lg p-3">
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Shield className="h-3.5 w-3.5" />
                                <span>{data.user.role}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Joined {formatDate(data.user.created_at)}</span>
                            </div>
                        </div>

                        {/* Activity timeline */}
                        <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4" />
                                Activity Timeline
                            </h3>
                            {data.logs.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    No activity recorded
                                </div>
                            ) : (
                                <div className="space-y-1 max-h-[350px] overflow-y-auto">
                                    {data.logs.map((log) => (
                                        <div
                                            key={log.id}
                                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 text-sm"
                                        >
                                            <div className="shrink-0">
                                                {actionIcons[log.action] || <Activity className="h-4 w-4 text-gray-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="font-medium">
                                                    {actionLabels[log.action] || log.action}
                                                </span>
                                                {log.entity_type && (
                                                    <span className="text-muted-foreground"> {log.entity_type}</span>
                                                )}
                                                {log.entity_name && (
                                                    <span className="text-muted-foreground"> &quot;{log.entity_name}&quot;</span>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-xs text-muted-foreground">
                                                {formatRelative(log.created_at)}
                                            </div>
                                            {log.ip_address && (
                                                <Badge variant="outline" className="text-[10px] shrink-0">
                                                    {log.ip_address}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
