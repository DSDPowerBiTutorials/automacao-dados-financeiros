'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserAvatar } from '@/components/user-avatar'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Bot,
    Play,
    RefreshCw,
    Clock,
    Zap,
    Bell,
    FileText,
    CheckCircle2,
    Plus,
    Pencil,
    Trash2,
    AlertTriangle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BotTask {
    id: string
    task_key: string
    name: string
    description?: string
    task_type: string
    cron_expression?: string
    is_active: boolean
    priority: number
    max_retries: number
    retry_delay_seconds: number
    timeout_seconds: number
    rate_limit_per_minute: number
    config: Record<string, unknown>
    last_run_at?: string
    last_status?: string
}

interface NotificationTemplate {
    id: string
    name: string
    event_type: string
    channel: string
    subject?: string
    body_template: string
    is_active: boolean
}

interface BotStats {
    totalTasks: number
    activeTasks: number
    totalExecutions: number
    successRate: number
    lastExecution?: string
}

const BOTELLA_USER = {
    email: 'botella@system.local',
    name: 'BOTella'
}

const taskTypeLabels: Record<string, { label: string; icon: typeof Zap; color: string }> = {
    sync: { label: 'Sincronização', icon: RefreshCw, color: 'bg-blue-100 text-blue-800' },
    reconciliation: { label: 'Reconciliação', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
    notification: { label: 'Notificação', icon: Bell, color: 'bg-orange-100 text-orange-800' },
    cleanup: { label: 'Limpeza', icon: Trash2, color: 'bg-gray-100 text-gray-800' },
    report: { label: 'Relatório', icon: FileText, color: 'bg-purple-100 text-purple-800' },
    backup: { label: 'Backup', icon: FileText, color: 'bg-cyan-100 text-cyan-800' }
}

const emptyTask: Partial<BotTask> = {
    task_key: '',
    name: '',
    description: '',
    task_type: 'sync',
    cron_expression: '0 8 * * *',
    is_active: true,
    priority: 5,
    max_retries: 3,
    retry_delay_seconds: 60,
    timeout_seconds: 300,
    rate_limit_per_minute: 60,
    config: {}
}

export default function BotellaSettingsPage() {
    const [tasks, setTasks] = useState<BotTask[]>([])
    const [templates, setTemplates] = useState<NotificationTemplate[]>([])
    const [stats, setStats] = useState<BotStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
    const [editingTask, setEditingTask] = useState<Partial<BotTask> | null>(null)
    const { toast } = useToast()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)

        const [tasksRes, templatesRes, logsRes] = await Promise.all([
            supabase.from('bot_tasks').select('*').order('priority'),
            supabase.from('bot_notification_templates').select('*'),
            supabase.from('bot_logs').select('status, started_at').order('started_at', { ascending: false }).limit(1000)
        ])

        setTasks(tasksRes.data || [])
        setTemplates(templatesRes.data || [])

        // Calcular estatísticas
        const logs = logsRes.data || []
        const successLogs = logs.filter(l => l.status === 'SUCCESS')
        const activeTasks = (tasksRes.data || []).filter(t => t.is_active)

        setStats({
            totalTasks: tasksRes.data?.length || 0,
            activeTasks: activeTasks.length,
            totalExecutions: logs.length,
            successRate: logs.length > 0 ? Math.round((successLogs.length / logs.length) * 100) : 0,
            lastExecution: logs[0]?.started_at
        })

        setLoading(false)
    }

    async function toggleTask(taskId: string, currentStatus: boolean) {
        const { error } = await supabase
            .from('bot_tasks')
            .update({ is_active: !currentStatus })
            .eq('id', taskId)

        if (error) {
            toast({ title: 'Erro ao alterar tarefa', variant: 'destructive' })
        } else {
            toast({ title: currentStatus ? 'Tarefa pausada' : 'Tarefa ativada' })
            loadData()
        }
    }

    async function runTaskNow(task: BotTask) {
        toast({ title: `Executando ${task.name}...` })

        // Aqui chamaria a API de execução
        try {
            const res = await fetch(`/api/cron/${task.task_key}`, { method: 'POST' })
            if (res.ok) {
                toast({ title: 'Tarefa executada com sucesso!' })
            } else {
                toast({ title: 'Erro ao executar tarefa', variant: 'destructive' })
            }
        } catch {
            toast({ title: 'Erro de conexão', variant: 'destructive' })
        }

        loadData()
    }

    async function saveTask() {
        if (!editingTask) return

        const taskData = {
            task_key: editingTask.task_key,
            name: editingTask.name,
            description: editingTask.description,
            task_type: editingTask.task_type,
            cron_expression: editingTask.cron_expression,
            is_active: editingTask.is_active,
            priority: editingTask.priority,
            max_retries: editingTask.max_retries,
            retry_delay_seconds: editingTask.retry_delay_seconds,
            timeout_seconds: editingTask.timeout_seconds,
            rate_limit_per_minute: editingTask.rate_limit_per_minute,
            config: editingTask.config || {}
        }

        if (editingTask.id) {
            // Update
            const { error } = await supabase
                .from('bot_tasks')
                .update(taskData)
                .eq('id', editingTask.id)

            if (error) {
                toast({ title: 'Erro ao atualizar tarefa', description: error.message, variant: 'destructive' })
            } else {
                toast({ title: 'Tarefa atualizada!' })
                setIsTaskDialogOpen(false)
                setEditingTask(null)
                loadData()
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('bot_tasks')
                .insert(taskData)

            if (error) {
                toast({ title: 'Erro ao criar tarefa', description: error.message, variant: 'destructive' })
            } else {
                toast({ title: 'Tarefa criada!' })
                setIsTaskDialogOpen(false)
                setEditingTask(null)
                loadData()
            }
        }
    }

    async function deleteTask(task: BotTask) {
        if (!confirm(`Tem certeza que deseja excluir a tarefa "${task.name}"?`)) return

        const { error } = await supabase
            .from('bot_tasks')
            .delete()
            .eq('id', task.id)

        if (error) {
            toast({ title: 'Erro ao excluir tarefa', variant: 'destructive' })
        } else {
            toast({ title: 'Tarefa excluída' })
            loadData()
        }
    }

    async function toggleTemplate(templateId: string, currentStatus: boolean) {
        await supabase
            .from('bot_notification_templates')
            .update({ is_active: !currentStatus })
            .eq('id', templateId)

        loadData()
    }

    function openCreateTaskDialog() {
        setEditingTask({ ...emptyTask })
        setIsTaskDialogOpen(true)
    }

    function openEditTaskDialog(task: BotTask) {
        setEditingTask({ ...task })
        setIsTaskDialogOpen(true)
    }

    function formatCron(cron?: string): string {
        if (!cron) return 'Manual'

        const parts = cron.split(' ')
        if (parts.length !== 5) return cron

        const [minute, hour, dayMonth, month, dayWeek] = parts

        if (hour === '*' && dayMonth === '*') {
            return `A cada hora às :${minute.padStart(2, '0')}`
        }
        if (dayMonth === '*' && month === '*' && dayWeek === '*') {
            return `Diário às ${hour}:${minute.padStart(2, '0')}`
        }
        if (dayWeek === '0') {
            return `Domingos às ${hour}:${minute.padStart(2, '0')}`
        }
        if (dayWeek === '1-5') {
            return `Dias úteis às ${hour}:${minute.padStart(2, '0')}`
        }
        return cron
    }

    function formatDate(date?: string): string {
        if (!date) return 'Nunca'
        return new Date(date).toLocaleString('pt-BR')
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header com avatar do BOTella */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-6">
                        <UserAvatar user={BOTELLA_USER} size="xl" />
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold">
                                <strong>BOT</strong>ella
                            </h2>
                            <p className="text-muted-foreground">
                                Sistema de Automação e Notificações
                            </p>
                            <div className="flex gap-4 mt-4">
                                <div className="bg-blue-50 px-4 py-2 rounded-lg">
                                    <div className="text-2xl font-bold text-blue-600">{stats?.activeTasks}</div>
                                    <div className="text-xs text-muted-foreground">Tarefas Ativas</div>
                                </div>
                                <div className="bg-green-50 px-4 py-2 rounded-lg">
                                    <div className="text-2xl font-bold text-green-600">{stats?.successRate}%</div>
                                    <div className="text-xs text-muted-foreground">Taxa de Sucesso</div>
                                </div>
                                <div className="bg-purple-50 px-4 py-2 rounded-lg">
                                    <div className="text-2xl font-bold text-purple-600">{stats?.totalExecutions}</div>
                                    <div className="text-xs text-muted-foreground">Execuções Total</div>
                                </div>
                                <div className="bg-gray-50 px-4 py-2 rounded-lg">
                                    <div className="text-sm font-medium">{formatDate(stats?.lastExecution)}</div>
                                    <div className="text-xs text-muted-foreground">Última Execução</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="tasks">
                <TabsList>
                    <TabsTrigger value="tasks">⚙️ Tarefas Agendadas</TabsTrigger>
                    <TabsTrigger value="templates">📧 Templates de Notificação</TabsTrigger>
                    <TabsTrigger value="settings">🔧 Configurações</TabsTrigger>
                </TabsList>

                {/* Tarefas */}
                <TabsContent value="tasks">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Tarefas Agendadas</CardTitle>
                                    <CardDescription>
                                        Configure as tarefas automáticas do <strong>BOT</strong>ella
                                    </CardDescription>
                                </div>
                                <Button onClick={openCreateTaskDialog}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nova Tarefa
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Nenhuma tarefa configurada</p>
                                        <Button variant="outline" className="mt-4" onClick={openCreateTaskDialog}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Criar primeira tarefa
                                        </Button>
                                    </div>
                                ) : (
                                    tasks.map(task => {
                                        const typeConfig = taskTypeLabels[task.task_type] || { label: task.task_type, icon: Zap, color: 'bg-gray-100 text-gray-800' }
                                        const TypeIcon = typeConfig.icon

                                        return (
                                            <div
                                                key={task.id}
                                                className={`flex items-center justify-between p-4 border rounded-lg ${task.is_active
                                                        ? 'bg-white border-green-200'
                                                        : 'bg-gray-50 border-gray-200 opacity-60'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${task.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                                                        <TypeIcon className={`h-5 w-5 ${task.is_active ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'}`} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{task.name}</span>
                                                            <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                                                            {task.last_status === 'FAILURE' && (
                                                                <Badge variant="destructive" className="gap-1">
                                                                    <AlertTriangle className="h-3 w-3" />
                                                                    Falhou
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {task.description}
                                                        </p>
                                                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {formatCron(task.cron_expression)}
                                                            </span>
                                                            <span>Prioridade: {task.priority}</span>
                                                            <span>Retries: {task.max_retries}x</span>
                                                            <span>Timeout: {task.timeout_seconds}s</span>
                                                            {task.last_run_at && (
                                                                <span>Última: {formatDate(task.last_run_at)}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openEditTaskDialog(task)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => runTaskNow(task)}
                                                    >
                                                        <Play className="h-4 w-4 mr-1" />
                                                        Executar
                                                    </Button>
                                                    <Switch
                                                        checked={task.is_active}
                                                        onCheckedChange={() => toggleTask(task.id, task.is_active)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Templates */}
                <TabsContent value="templates">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Templates de Notificação</CardTitle>
                                    <CardDescription>
                                        Modelos de mensagens enviadas pelo <strong>BOT</strong>ella
                                    </CardDescription>
                                </div>
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Novo Template
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {templates.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>Nenhum template configurado</p>
                                    </div>
                                ) : (
                                    templates.map(template => (
                                        <div
                                            key={template.id}
                                            className={`p-4 border rounded-lg ${template.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <Bell className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">{template.name}</span>
                                                    <Badge variant="outline">{template.channel}</Badge>
                                                    <Badge variant="secondary">{template.event_type}</Badge>
                                                </div>
                                                <Switch
                                                    checked={template.is_active}
                                                    onCheckedChange={() => toggleTemplate(template.id, template.is_active)}
                                                />
                                            </div>
                                            {template.subject && (
                                                <p className="text-sm font-medium mb-1">{template.subject}</p>
                                            )}
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {template.body_template}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Configurações Gerais */}
                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configurações do BOTella</CardTitle>
                            <CardDescription>
                                Parâmetros gerais de funcionamento
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <p className="font-medium">Reconciliação Automática</p>
                                    <p className="text-sm text-muted-foreground">
                                        Executar reconciliação automaticamente após sync
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <p className="font-medium">Notificações de Erro</p>
                                    <p className="text-sm text-muted-foreground">
                                        Enviar email quando uma tarefa falhar
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <p className="font-medium">Relatório Diário</p>
                                    <p className="text-sm text-muted-foreground">
                                        Enviar resumo diário às 08:00
                                    </p>
                                </div>
                                <Switch defaultChecked />
                            </div>

                            <div className="p-4 border rounded-lg">
                                <p className="font-medium mb-2">Horário do Relatório Diário</p>
                                <Select defaultValue="08:00">
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="06:00">06:00</SelectItem>
                                        <SelectItem value="07:00">07:00</SelectItem>
                                        <SelectItem value="08:00">08:00</SelectItem>
                                        <SelectItem value="09:00">09:00</SelectItem>
                                        <SelectItem value="10:00">10:00</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="p-4 border rounded-lg">
                                <p className="font-medium mb-2">Retenção de Logs (dias)</p>
                                <Input type="number" defaultValue={90} className="w-[180px]" />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Dialog de Criar/Editar Tarefa */}
            <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTask?.id ? 'Editar Tarefa' : 'Nova Tarefa'}
                        </DialogTitle>
                        <DialogDescription>
                            Configure os parâmetros da tarefa automática
                        </DialogDescription>
                    </DialogHeader>

                    {editingTask && (
                        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Chave (ID único)</label>
                                    <Input
                                        value={editingTask.task_key}
                                        onChange={e => setEditingTask({ ...editingTask, task_key: e.target.value })}
                                        placeholder="sync-braintree-eur"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nome</label>
                                    <Input
                                        value={editingTask.name}
                                        onChange={e => setEditingTask({ ...editingTask, name: e.target.value })}
                                        placeholder="Sync Braintree EUR"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Descrição</label>
                                <Textarea
                                    value={editingTask.description}
                                    onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                                    placeholder="Sincroniza transações do Braintree em EUR"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Tipo</label>
                                    <Select
                                        value={editingTask.task_type}
                                        onValueChange={v => setEditingTask({ ...editingTask, task_type: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="sync">Sincronização</SelectItem>
                                            <SelectItem value="reconciliation">Reconciliação</SelectItem>
                                            <SelectItem value="notification">Notificação</SelectItem>
                                            <SelectItem value="cleanup">Limpeza</SelectItem>
                                            <SelectItem value="report">Relatório</SelectItem>
                                            <SelectItem value="backup">Backup</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Cron Expression</label>
                                    <Input
                                        value={editingTask.cron_expression}
                                        onChange={e => setEditingTask({ ...editingTask, cron_expression: e.target.value })}
                                        placeholder="0 8 * * *"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {formatCron(editingTask.cron_expression)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Prioridade</label>
                                    <Input
                                        type="number"
                                        value={editingTask.priority}
                                        onChange={e => setEditingTask({ ...editingTask, priority: parseInt(e.target.value) })}
                                        min={1}
                                        max={10}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Max Retries</label>
                                    <Input
                                        type="number"
                                        value={editingTask.max_retries}
                                        onChange={e => setEditingTask({ ...editingTask, max_retries: parseInt(e.target.value) })}
                                        min={0}
                                        max={10}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Retry Delay (s)</label>
                                    <Input
                                        type="number"
                                        value={editingTask.retry_delay_seconds}
                                        onChange={e => setEditingTask({ ...editingTask, retry_delay_seconds: parseInt(e.target.value) })}
                                        min={1}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Timeout (s)</label>
                                    <Input
                                        type="number"
                                        value={editingTask.timeout_seconds}
                                        onChange={e => setEditingTask({ ...editingTask, timeout_seconds: parseInt(e.target.value) })}
                                        min={10}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 border rounded-lg">
                                <Switch
                                    checked={editingTask.is_active}
                                    onCheckedChange={v => setEditingTask({ ...editingTask, is_active: v })}
                                />
                                <div>
                                    <p className="font-medium">Tarefa Ativa</p>
                                    <p className="text-sm text-muted-foreground">
                                        Se desativada, a tarefa não será executada automaticamente
                                    </p>
                                </div>
                            </div>

                            {editingTask.id && (
                                <div className="pt-4 border-t">
                                    <Button
                                        variant="destructive"
                                        onClick={() => {
                                            deleteTask(editingTask as BotTask)
                                            setIsTaskDialogOpen(false)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir Tarefa
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={saveTask}>
                            {editingTask?.id ? 'Salvar' : 'Criar Tarefa'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
