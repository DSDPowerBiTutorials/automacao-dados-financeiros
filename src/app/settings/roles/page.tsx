'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Check } from 'lucide-react'

const roles = [
    {
        name: 'Admin',
        description: 'Acesso total ao sistema',
        permissions: ['*'],
        color: 'bg-red-100 text-red-800'
    },
    {
        name: 'Gerente',
        description: 'Leitura, escrita e gestão de usuários',
        permissions: ['read', 'write', 'export', 'manage_users'],
        color: 'bg-purple-100 text-purple-800'
    },
    {
        name: 'Editor',
        description: 'Leitura e escrita limitada',
        permissions: ['read', 'write', 'export'],
        color: 'bg-blue-100 text-blue-800'
    },
    {
        name: 'Visualizador',
        description: 'Apenas leitura',
        permissions: ['read'],
        color: 'bg-gray-100 text-gray-800'
    }
]

const allPermissions = [
    { key: 'read', label: 'Leitura' },
    { key: 'write', label: 'Escrita' },
    { key: 'export', label: 'Exportar' },
    { key: 'import', label: 'Importar' },
    { key: 'manage_users', label: 'Gerenciar Usuários' },
    { key: 'manage_settings', label: 'Gerenciar Configurações' },
    { key: 'view_audit', label: 'Ver Auditoria' },
    { key: 'manage_bot', label: 'Gerenciar BOT' },
]

export default function RolesPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Papéis & Permissões</CardTitle>
                    <CardDescription>
                        Gerencie os papéis do sistema e suas permissões
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {roles.map(role => (
                            <div key={role.name} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <Shield className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <span className="font-medium">{role.name}</span>
                                            <p className="text-sm text-muted-foreground">{role.description}</p>
                                        </div>
                                    </div>
                                    <Badge className={role.color}>{role.name}</Badge>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    {allPermissions.map(perm => {
                                        const hasPermission = role.permissions.includes('*') || role.permissions.includes(perm.key)
                                        return (
                                            <div
                                                key={perm.key}
                                                className={`flex items-center gap-2 p-2 rounded text-sm ${hasPermission ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                                                    }`}
                                            >
                                                {hasPermission && <Check className="h-4 w-4" />}
                                                {perm.label}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
