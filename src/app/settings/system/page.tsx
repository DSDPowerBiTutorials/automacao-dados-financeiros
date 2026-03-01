'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building, Globe, Calendar, DollarSign, Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

export default function SystemPage() {
    const [settings, setSettings] = useState({
        companyName: 'DSD Power BI',
        timezone: 'Europe/Madrid',
        dateFormat: 'DD/MM/YYYY',
        currency: 'EUR',
        language: 'pt-BR'
    })

    return (
        <div className="space-y-6">
            <PageHeader title="Company Settings" subtitle="Organization details and configuration" />
            <Card>
                <CardHeader>
                    <CardTitle>Informações da Empresa</CardTitle>
                    <CardDescription>
                        Configurações gerais da organização
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            Nome da Empresa
                        </label>
                        <Input
                            value={settings.companyName}
                            onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Localização</CardTitle>
                    <CardDescription>
                        Configure fuso horário, formatos e moeda padrão
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Fuso Horário
                            </label>
                            <Select
                                value={settings.timezone}
                                onValueChange={v => setSettings({ ...settings, timezone: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Europe/Madrid">Europe/Madrid (CET)</SelectItem>
                                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                                    <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                Idioma
                            </label>
                            <Select
                                value={settings.language}
                                onValueChange={v => setSettings({ ...settings, language: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                                    <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                                    <SelectItem value="es-ES">Español</SelectItem>
                                    <SelectItem value="en-US">English (US)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Formato de Data
                            </label>
                            <Select
                                value={settings.dateFormat}
                                onValueChange={v => setSettings({ ...settings, dateFormat: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Moeda Padrão
                            </label>
                            <Select
                                value={settings.currency}
                                onValueChange={v => setSettings({ ...settings, currency: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EUR">EUR (€)</SelectItem>
                                    <SelectItem value="USD">USD ($)</SelectItem>
                                    <SelectItem value="GBP">GBP (£)</SelectItem>
                                    <SelectItem value="BRL">BRL (R$)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manutenção</CardTitle>
                    <CardDescription>
                        Ações de manutenção do sistema
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Limpar Cache</p>
                            <p className="text-sm text-muted-foreground">Remove dados em cache do sistema</p>
                        </div>
                        <Button variant="outline">Limpar</Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Reindexar Dados</p>
                            <p className="text-sm text-muted-foreground">Reconstrói índices de busca</p>
                        </div>
                        <Button variant="outline">Reindexar</Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <p className="font-medium">Exportar Backup</p>
                            <p className="text-sm text-muted-foreground">Download completo dos dados</p>
                        </div>
                        <Button variant="outline">Exportar</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Configurações
                </Button>
            </div>
        </div>
    )
}
