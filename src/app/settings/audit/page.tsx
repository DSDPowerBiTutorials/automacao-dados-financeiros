'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Search,
    RefreshCw,
    Download,
    Filter,
    Calendar,
    Eye
} from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'

interface AuditLog {
    id: string
    user_id?: string
    user_email: string
    user_name: string
    action: string
    entity_type: string
    entity_id?: string
    entity_name?: string
    changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> }
    ip_address?: string
    created_at: string
    metadata?: Record<string, unknown>
}

const actionLabels: Record<string, { label: string; color: string }> = {
    create: { label: 'Criou', color: 'bg-green-100 text-green-800' },
    update: { label: 'Atualizou', color: 'bg-blue-100 text-blue-800' },
    delete: { label: 'Excluiu', color: 'bg-red-100 text-red-800' },
    login: { label: 'Login', color: 'bg-purple-100 text-purple-800' },
    logout: { label: 'Logout', color: 'bg-gray-100 text-gray-800' },
    export: { label: 'Exportou', color: 'bg-yellow-100 text-yellow-800' },
    import: { label: 'Importou', color: 'bg-cyan-100 text-cyan-800' },
    reconcile: { label: 'Reconciliou', color: 'bg-emerald-100 text-emerald-800' },
    sync: { label: 'Sincronizou', color: 'bg-indigo-100 text-indigo-800' },
    bot_task: { label: 'Tarefa Bot', color: 'bg-blue-100 text-blue-800' },
}

const entityLabels: Record<string, string> = {
    invoice: 'Fatura',
    transaction: 'Transação',
    user: 'Usuário',
    settings: 'Configurações',
    provider: 'Fornecedor',
    bank_account: 'Conta Bancária',
    csv_file: 'Arquivo CSV',
    reconciliation: 'Reconciliação',
    bot_task: 'Tarefa BOT',
    notification: 'Notificação',
}

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [botLogs, setBotLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [actionFilter, setActionFilter] = useState('all')
    const [entityFilter, setEntityFilter] = useState('all')
    const [viewMode, setViewMode] = useState<'all' | 'users' | 'bot'>('all')
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

    useEffect(() => {
        loadLogs()
    }, [])

    async function loadLogs() {
        setLoading(true)

        // Carregar logs de auditoria (usuários)
        const { data: auditData } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200)

        // Carregar logs do BOTella
        const { data: botData } = await supabase
            .from('bot_logs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(200)

        // Converter bot_logs para formato de audit_logs
        const convertedBotLogs: AuditLog[] = (botData || []).map(log => ({
            id: log.id,
            user_email: 'botella@system.local',
            user_name: 'BOTella',
            action: log.status === 'SUCCESS' ? 'sync' : log.status === 'FAILURE' ? 'error' : 'bot_task',
            entity_type: 'bot_task',
            entity_name: log.task_name,
            created_at: log.started_at,
            metadata: {
                status: log.status,
                duration_ms: log.duration_ms,
                attempt: log.attempt,
                error_message: log.error_message,
                result: log.result
            }
        }))

        setLogs(auditData || [])
        setBotLogs(convertedBotLogs)
        setLoading(false)
    }

    function getAllLogs(): AuditLog[] {
        let combined: AuditLog[] = []

        if (viewMode === 'all') {
            combined = [...logs, ...botLogs]
        } else if (viewMode === 'users') {
            combined = logs
        } else {
            combined = botLogs
        }

        return combined
            .filter(log => {
                const matchesSearch =
                    log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
                    log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
                    log.entity_name?.toLowerCase().includes(search.toLowerCase())
                const matchesAction = actionFilter === 'all' || log.action === actionFilter
                const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter
                return matchesSearch && matchesAction && matchesEntity
            })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }

    function formatDate(date: string): string {
        return new Date(date).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    function exportToCSV() {
        const data = getAllLogs()
        const csv = [
            ['Data', 'Usuário', 'Email', 'Ação', 'Entidade', 'Nome', 'IP'].join(','),
            ...data.map(log => [
                formatDate(log.created_at),
                log.user_name,
                log.user_email,
                log.action,
                log.entity_type,
                log.entity_name || '',
                log.ip_address || ''
            ].join(','))
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
    }

    const filteredLogs = getAllLogs()

    return (
        <div className="space-y-6">
            <PageHeader title="Audit Logs" subtitle="System activity and change history" />
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Logs de Auditoria</CardTitle>
                            <CardDescription>
                                Histórico completo de ações no sistema (usuários + <strong>BOT</strong>ella)
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={loadLogs}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Atualizar
                            </Button>
                            <Button variant="outline" size="sm" onClick={exportToCSV}>
                                <Download className="h-4 w-4 mr-2" />
                                Exportar
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-4 mb-6">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por usuário ou entidade..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <Select value={viewMode} onValueChange={(v: 'all' | 'users' | 'bot') => setViewMode(v)}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="users">Só Usuários</SelectItem>
                                <SelectItem value="bot">Só BOTella</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[160px]">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Ação" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas ações</SelectItem>
                                <SelectItem value="create">Criação</SelectItem>
                                <SelectItem value="update">Atualização</SelectItem>
                                <SelectItem value="delete">Exclusão</SelectItem>
                                <SelectItem value="login">Login</SelectItem>
                                <SelectItem value="export">Exportação</SelectItem>
                                <SelectItem value="sync">Sincronização</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={entityFilter} onValueChange={setEntityFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Entidade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas entidades</SelectItem>
                                <SelectItem value="invoice">Faturas</SelectItem>
                                <SelectItem value="transaction">Transações</SelectItem>
                                <SelectItem value="user">Usuários</SelectItem>
                                <SelectItem value="bot_task">Tarefas BOT</SelectItem>
                                <SelectItem value="csv_file">Arquivos CSV</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Estatísticas rápidas */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold">{logs.length + botLogs.length}</div>
                            <div className="text-xs text-muted-foreground">Total de Logs</div>
                        </div>
                        <div className="bg-green-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {[...logs, ...botLogs].filter(l => l.action === 'create' || l.action === 'sync').length}
                            </div>
                            <div className="text-xs text-muted-foreground">Criações/Syncs</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {logs.filter(l => l.action === 'update').length}
                            </div>
                            <div className="text-xs text-muted-foreground">Atualizações</div>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold text-purple-600">{botLogs.length}</div>
                            <div className="text-xs text-muted-foreground">Ações BOTella</div>
                        </div>
                    </div>

                    {/* Lista de logs */}
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="h-6 w-6 animate-spin" />
                            </div>
                        ) : filteredLogs.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum log encontrado
                            </div>
                        ) : (
                            filteredLogs.map(log => {
                                const actionConfig = actionLabels[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800' }
                                const isBotella = log.user_email === 'botella@system.local'

                                return (
                                    <div
                                        key={log.id}
                                        className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${isBotella ? 'border-l-4 border-l-blue-500' : ''
                                            }`}
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <UserAvatar
                                                user={{ email: log.user_email, name: log.user_name }}
                                                size="sm"
                                            />
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                        {isBotella ? (
                                                            <><strong>BOT</strong>ella</>
                                                        ) : (
                                                            log.user_name
                                                        )}
                                                    </span>
                                                    <Badge className={actionConfig.color}>
                                                        {actionConfig.label}
                                                    </Badge>
                                                    <span className="text-muted-foreground">
                                                        {entityLabels[log.entity_type] || log.entity_type}
                                                    </span>
                                                    {log.entity_name && (
                                                        <span className="text-sm font-medium">
                                                            &quot;{log.entity_name}&quot;
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    {formatDate(log.created_at)}
                                                    {log.ip_address && (
                                                        <>
                                                            <span>•</span>
                                                            <span>IP: {log.ip_address}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm">
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Dialog de detalhes */}
            <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Log</DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Usuário</label>
                                    <p className="font-medium">{selectedLog.user_name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedLog.user_email}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Data/Hora</label>
                                    <p>{formatDate(selectedLog.created_at)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Ação</label>
                                    <p>{actionLabels[selectedLog.action]?.label || selectedLog.action}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Entidade</label>
                                    <p>{entityLabels[selectedLog.entity_type] || selectedLog.entity_type}</p>
                                    {selectedLog.entity_name && (
                                        <p className="text-sm text-muted-foreground">{selectedLog.entity_name}</p>
                                    )}
                                </div>
                            </div>

                            {selectedLog.changes && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Alterações</label>
                                    <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-[200px]">
                                        {JSON.stringify(selectedLog.changes, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Metadados</label>
                                    <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-[200px]">
                                        {JSON.stringify(selectedLog.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
