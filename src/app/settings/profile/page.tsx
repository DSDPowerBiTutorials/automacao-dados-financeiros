'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Camera, Mail, Phone, Building, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ProfilePage() {
    const { toast } = useToast()

    // TODO: Pegar do contexto de autenticação
    const [user] = useState({
        id: '1',
        email: 'fernando@dsd.com',
        name: 'Fernando',
        role: 'admin',
        department: 'Financeiro',
        phone: '+34 600 000 000',
        avatar_url: '/avatars/fernando.png'
    })

    const [formData, setFormData] = useState({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        department: user.department || ''
    })

    function handleSave() {
        // TODO: Salvar no Supabase
        toast({ title: 'Perfil atualizado com sucesso!' })
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Meu Perfil</CardTitle>
                    <CardDescription>
                        Gerencie suas informações pessoais
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start gap-8">
                        {/* Avatar */}
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <UserAvatar user={user} size="xl" />
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                                >
                                    <Camera className="h-4 w-4" />
                                </Button>
                            </div>
                            <Badge className="bg-red-100 text-red-800">
                                <Shield className="h-3 w-3 mr-1" />
                                {user.role === 'admin' ? 'Administrador' : user.role}
                            </Badge>
                        </div>

                        {/* Form */}
                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Nome</label>
                                    <Input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Telefone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Departamento</label>
                                    <div className="relative">
                                        <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button onClick={handleSave}>
                                    Salvar Alterações
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Atividade Recente */}
            <Card>
                <CardHeader>
                    <CardTitle>Atividade Recente</CardTitle>
                    <CardDescription>
                        Suas últimas ações no sistema
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhuma atividade recente
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
