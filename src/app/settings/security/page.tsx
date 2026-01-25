'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Lock, Key, Shield, Smartphone, Clock, AlertTriangle } from 'lucide-react'

export default function SecurityPage() {
    const [settings, setSettings] = useState({
        require2FA: false,
        sessionTimeout: 24,
        passwordMinLength: 8,
        requireSpecialChars: true
    })

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Autenticação</CardTitle>
                    <CardDescription>
                        Configure as políticas de autenticação
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Autenticação de Dois Fatores (2FA)</p>
                                <p className="text-sm text-muted-foreground">Exigir 2FA para todos os usuários</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.require2FA}
                            onCheckedChange={v => setSettings({ ...settings, require2FA: v })}
                        />
                    </div>

                    <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Timeout de Sessão</p>
                                <p className="text-sm text-muted-foreground">Tempo em horas até exigir novo login</p>
                            </div>
                        </div>
                        <Input
                            type="number"
                            value={settings.sessionTimeout}
                            onChange={e => setSettings({ ...settings, sessionTimeout: parseInt(e.target.value) })}
                            className="w-[100px]"
                            min={1}
                            max={168}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Política de Senhas</CardTitle>
                    <CardDescription>
                        Defina os requisitos mínimos para senhas
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-3">
                            <Key className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Tamanho Mínimo</p>
                                <p className="text-sm text-muted-foreground">Número mínimo de caracteres</p>
                            </div>
                        </div>
                        <Input
                            type="number"
                            value={settings.passwordMinLength}
                            onChange={e => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
                            className="w-[100px]"
                            min={6}
                            max={32}
                        />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p className="font-medium">Caracteres Especiais</p>
                                <p className="text-sm text-muted-foreground">Exigir pelo menos um caractere especial</p>
                            </div>
                        </div>
                        <Switch
                            checked={settings.requireSpecialChars}
                            onCheckedChange={v => setSettings({ ...settings, requireSpecialChars: v })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sessões Ativas</CardTitle>
                    <CardDescription>
                        Gerencie suas sessões ativas em outros dispositivos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <p className="font-medium">Este dispositivo</p>
                                <p className="text-sm text-muted-foreground">Chrome • Linux • Agora</p>
                            </div>
                            <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                        </div>
                    </div>

                    <Button variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        Encerrar Todas as Outras Sessões
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Alterar Senha</CardTitle>
                    <CardDescription>
                        Atualize sua senha de acesso
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Senha Atual</label>
                        <Input type="password" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nova Senha</label>
                        <Input type="password" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Confirmar Nova Senha</label>
                        <Input type="password" />
                    </div>
                    <Button>
                        <Lock className="h-4 w-4 mr-2" />
                        Alterar Senha
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
