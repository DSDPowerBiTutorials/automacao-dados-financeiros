"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Bot,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    Activity,
    Zap,
    Database,
    Trash2,
    Bell,
    Archive,
    Play,
    Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";

// ============================================================================
// TIPOS
// ============================================================================

interface BotLog {
    id: number;
    bot_name: string;
    task_name: string;
    task_type: string;
    status: string;
    message: string | null;
    details: Record<string, unknown> | null;
    records_processed: number;
    records_created: number;
    records_updated: number;
    records_failed: number;
    duration_ms: number | null;
    error_message: string | null;
    started_at: string;
    completed_at: string | null;
    created_at: string;
}

interface BotTask {
    id: number;
    task_key: string;
    task_name: string;
    task_type: string;
    description: string | null;
    schedule: string | null;
    is_enabled: boolean;
    last_run_at: string | null;
    last_status: string | null;
}

interface BotStats {
    totalTasks: number;
    completed: number;
    failed: number;
    warnings: number;
    avgDurationMs: number;
    totalRecordsProcessed: number;
}

// ============================================================================
// COMPONENTE NOME DO BOT
// ============================================================================

function BotName({ className = "" }: { className?: string }) {
    return (
        <span className={className}>
            <strong className="font-bold">BOT</strong>ella
        </span>
    );
}

// ============================================================================
// COMPONENTE STATUS BADGE
// ============================================================================

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
        started: { icon: <Play className="h-3 w-3" />, variant: "secondary", label: "Iniciado" },
        running: { icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "default", label: "Executando" },
        completed: { icon: <CheckCircle2 className="h-3 w-3" />, variant: "default", label: "Concluído" },
        failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive", label: "Falhou" },
        warning: { icon: <AlertTriangle className="h-3 w-3" />, variant: "outline", label: "Warning" },
    };

    const { icon, variant, label } = config[status] || config.started;

    return (
        <Badge
            variant={variant}
            className={`gap-1 ${status === "completed" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""} ${status === "warning" ? "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100" : ""}`}
        >
            {icon}
            {label}
        </Badge>
    );
}

// ============================================================================
// COMPONENTE TIPO BADGE
// ============================================================================

function TaskTypeBadge({ type }: { type: string }) {
    const config: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
        sync: { icon: <RefreshCw className="h-3 w-3" />, color: "bg-blue-100 text-blue-800", label: "Sync" },
        reconciliation: { icon: <Zap className="h-3 w-3" />, color: "bg-purple-100 text-purple-800", label: "Reconciliação" },
        cleanup: { icon: <Trash2 className="h-3 w-3" />, color: "bg-gray-100 text-gray-800", label: "Limpeza" },
        notification: { icon: <Bell className="h-3 w-3" />, color: "bg-orange-100 text-orange-800", label: "Notificação" },
        backup: { icon: <Archive className="h-3 w-3" />, color: "bg-green-100 text-green-800", label: "Backup" },
    };

    const { icon, color, label } = config[type] || { icon: <Activity className="h-3 w-3" />, color: "bg-gray-100 text-gray-800", label: type };

    return (
        <Badge variant="outline" className={`gap-1 ${color} border-0`}>
            {icon}
            {label}
        </Badge>
    );
}

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================

export default function BotLogsPage() {
    const [logs, setLogs] = useState<BotLog[]>([]);
    const [tasks, setTasks] = useState<BotTask[]>([]);
    const [stats, setStats] = useState<BotStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>("all");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchData = useCallback(async () => {
        setLoading(true);

        try {
            // Buscar logs
            let logsQuery = supabase
                .from("bot_logs")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(100);

            if (filterType !== "all") {
                logsQuery = logsQuery.eq("task_type", filterType);
            }

            if (filterStatus !== "all") {
                logsQuery = logsQuery.eq("status", filterStatus);
            }

            const { data: logsData } = await logsQuery;

            // Buscar tarefas
            const { data: tasksData } = await supabase
                .from("bot_tasks")
                .select("*")
                .order("task_type", { ascending: true });

            // Calcular estatísticas
            const since = new Date();
            since.setDate(since.getDate() - 7);

            const { data: statsData } = await supabase
                .from("bot_logs")
                .select("status, duration_ms, records_processed")
                .gte("started_at", since.toISOString());

            if (statsData) {
                setStats({
                    totalTasks: statsData.length,
                    completed: statsData.filter((l) => l.status === "completed").length,
                    failed: statsData.filter((l) => l.status === "failed").length,
                    warnings: statsData.filter((l) => l.status === "warning").length,
                    avgDurationMs:
                        statsData.length > 0
                            ? Math.round(
                                statsData.reduce((sum, l) => sum + (l.duration_ms || 0), 0) /
                                statsData.length
                            )
                            : 0,
                    totalRecordsProcessed: statsData.reduce(
                        (sum, l) => sum + (l.records_processed || 0),
                        0
                    ),
                });
            }

            setLogs(logsData || []);
            setTasks(tasksData || []);
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
        } finally {
            setLoading(false);
        }
    }, [supabase, filterType, filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleTask = async (taskKey: string, enabled: boolean) => {
        await supabase
            .from("bot_tasks")
            .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
            .eq("task_key", taskKey);

        setTasks((prev) =>
            prev.map((t) => (t.task_key === taskKey ? { ...t, is_enabled: enabled } : t))
        );
    };

    const formatDuration = (ms: number | null) => {
        if (!ms) return "-";
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <PageHeader title="Bot Logs" subtitle="Sistema de Automação e Logs">
                <Button onClick={fetchData} disabled={loading} variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                    Atualizar
                </Button>
            </PageHeader>

            {/* Stats Cards */}
            {stats && (
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Tarefas (7 dias)
                            </CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalTasks}</div>
                            <p className="text-xs text-muted-foreground">
                                {stats.completed} concluídas, {stats.failed} falhas
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {stats.totalTasks > 0
                                    ? Math.round((stats.completed / stats.totalTasks) * 100)
                                    : 0}
                                %
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {stats.warnings} warnings
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatDuration(stats.avgDurationMs)}
                            </div>
                            <p className="text-xs text-muted-foreground">por tarefa</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                Registros Processados
                            </CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.totalRecordsProcessed.toLocaleString("pt-BR")}
                            </div>
                            <p className="text-xs text-muted-foreground">nos últimos 7 dias</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="logs" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="logs">📋 Logs</TabsTrigger>
                    <TabsTrigger value="tasks">⚙️ Tarefas Configuradas</TabsTrigger>
                </TabsList>

                {/* Tab: Logs */}
                <TabsContent value="logs" className="space-y-4">
                    {/* Filtros */}
                    <div className="flex gap-4">
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os tipos</SelectItem>
                                <SelectItem value="sync">Sync</SelectItem>
                                <SelectItem value="reconciliation">Reconciliação</SelectItem>
                                <SelectItem value="cleanup">Limpeza</SelectItem>
                                <SelectItem value="notification">Notificação</SelectItem>
                                <SelectItem value="backup">Backup</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os status</SelectItem>
                                <SelectItem value="completed">Concluído</SelectItem>
                                <SelectItem value="failed">Falhou</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="running">Executando</SelectItem>
                                <SelectItem value="started">Iniciado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Tabela de Logs */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tarefa</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Mensagem</TableHead>
                                        <TableHead className="text-right">Registros</TableHead>
                                        <TableHead className="text-right">Duração</TableHead>
                                        <TableHead>Quando</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-500 dark:text-gray-400" />
                                            </TableCell>
                                        </TableRow>
                                    ) : logs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                                Nenhum log encontrado
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="font-medium">{log.task_name}</TableCell>
                                                <TableCell>
                                                    <TaskTypeBadge type={log.task_type} />
                                                </TableCell>
                                                <TableCell>
                                                    <StatusBadge status={log.status} />
                                                </TableCell>
                                                <TableCell className="max-w-[300px] truncate text-sm text-gray-600">
                                                    {log.error_message || log.message || "-"}
                                                </TableCell>
                                                <TableCell className="text-right text-sm">
                                                    {log.records_processed > 0 && (
                                                        <span className="text-gray-700">
                                                            {log.records_processed.toLocaleString("pt-BR")}
                                                        </span>
                                                    )}
                                                    {log.records_created > 0 && (
                                                        <span className="text-green-600 ml-2">
                                                            +{log.records_created}
                                                        </span>
                                                    )}
                                                    {log.records_failed > 0 && (
                                                        <span className="text-red-600 ml-2">
                                                            -{log.records_failed}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-sm text-gray-600">
                                                    {formatDuration(log.duration_ms)}
                                                </TableCell>
                                                <TableCell className="text-sm text-gray-500">
                                                    {formatDistanceToNow(new Date(log.created_at), {
                                                        addSuffix: true,
                                                        locale: ptBR,
                                                    })}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab: Tarefas */}
                <TabsContent value="tasks">
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tarefa</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Schedule</TableHead>
                                        <TableHead>Última Execução</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Ativo</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasks.map((task) => (
                                        <TableRow key={task.id}>
                                            <TableCell className="font-medium">{task.task_name}</TableCell>
                                            <TableCell>
                                                <TaskTypeBadge type={task.task_type} />
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 max-w-[250px] truncate">
                                                {task.description || "-"}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-gray-500">
                                                {task.schedule || "-"}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {task.last_run_at
                                                    ? formatDistanceToNow(new Date(task.last_run_at), {
                                                        addSuffix: true,
                                                        locale: ptBR,
                                                    })
                                                    : "Nunca"}
                                            </TableCell>
                                            <TableCell>
                                                {task.last_status && <StatusBadge status={task.last_status} />}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch
                                                    checked={task.is_enabled}
                                                    onCheckedChange={(checked) =>
                                                        toggleTask(task.task_key, checked)
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
