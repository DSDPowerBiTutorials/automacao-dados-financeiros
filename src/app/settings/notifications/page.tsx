'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react'

export default function NotificationsPage() {
    const [settings, setSettings] = useState({
        emailEnabled: true,
        pushEnabled: true,
        smsEnabled: false,
        digestFrequency: 'daily',
        taskSuccess: true,
        taskFailure: true,
        reconciliationComplete: true,
        dailyReport: true
    })

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Canais de Notificação</CardTitle>
                    <CardDescription>
                        Configure como você deseja receber notificações
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Email</p>
                                <p className="text-sm text-muted-foreground">Receber notificações por email</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.emailEnabled}
                            onCheckedChange={v => setSettings({ ...settings, emailEnabled: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Bell className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Push (Navegador)</p>
                                <p className="text-sm text-muted-foreground">Notificações push no navegador</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.pushEnabled}
                            onCheckedChange={v => setSettings({ ...settings, pushEnabled: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">SMS</p>
                                <p className="text-sm text-muted-foreground">Mensagens de texto (somente críticos)</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.smsEnabled}
                            onCheckedChange={v => setSettings({ ...settings, smsEnabled: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tipos de Notificação</CardTitle>
                    <CardDescription>
                        Escolha quais eventos devem gerar notificações
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Tarefas Concluídas</p>
                            <p className="text-sm text-muted-foreground">Quando uma tarefa do BOT terminar com sucesso</p>
                        </div>
                        <Switch
                            checked={settings.taskSuccess}
                            onCheckedChange={v => setSettings({ ...settings, taskSuccess: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Falhas de Tarefas</p>
                            <p className="text-sm text-muted-foreground">Quando uma tarefa do BOT falhar</p>
                        </div>
                        <Switch
                            checked={settings.taskFailure}
                            onCheckedChange={v => setSettings({ ...settings, taskFailure: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Reconciliação Completa</p>
                            <p className="text-sm text-muted-foreground">Quando a reconciliação automática terminar</p>
                        </div>
                        <Switch
                            checked={settings.reconciliationComplete}
                            onCheckedChange={v => setSettings({ ...settings, reconciliationComplete: v })}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Relatório Diário</p>
                            <p className="text-sm text-muted-foreground">Resumo diário de atividades</p>
                        </div>
                        <Switch
                            checked={settings.dailyReport}
                            onCheckedChange={v => setSettings({ ...settings, dailyReport: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Frequência do Resumo</CardTitle>
                    <CardDescription>
                        Com que frequência você quer receber o resumo de atividades
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Select
                        value={settings.digestFrequency}
                        onValueChange={v => setSettings({ ...settings, digestFrequency: v })}
                    >
                        <SelectTrigger className="w-[200px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="realtime">Tempo Real</SelectItem>
                            <SelectItem value="hourly">A cada hora</SelectItem>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="never">Nunca</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
    )
}
