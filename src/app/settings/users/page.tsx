'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/user-avatar'
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Plus,
    Search,
    MoreHorizontal,
    Pencil,
    Trash2,
    UserX,
    UserCheck,
    Mail,
    Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SystemUser {
    id: string
    email: string
    name: string
    avatar_url?: string
    role: 'admin' | 'manager' | 'editor' | 'viewer'
    department?: string
    phone?: string
    is_active: boolean
    last_login_at?: string
    created_at: string
}

const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
    manager: { label: 'Gerente', color: 'bg-purple-100 text-purple-800' },
    editor: { label: 'Editor', color: 'bg-blue-100 text-blue-800' },
    viewer: { label: 'Visualizador', color: 'bg-gray-100 text-gray-800' },
}

export default function UsersPage() {
    const [users, setUsers] = useState<SystemUser[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null)
    const { toast } = useToast()

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'viewer' as SystemUser['role'],
        department: '',
        phone: ''
    })

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('system_users')
            .select('*')
            .order('name')

        if (error) {
            toast({ title: 'Erro ao carregar usuários', variant: 'destructive' })
        } else {
            setUsers(data || [])
        }
        setLoading(false)
    }

    async function handleCreateUser() {
        const { error } = await supabase.from('system_users').insert({
            ...formData,
            avatar_url: `/avatars/${formData.name.toLowerCase()}.png`
        })

        if (error) {
            toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' })
        } else {
            toast({ title: 'Usuário criado com sucesso!' })
            setIsCreateOpen(false)
            resetForm()
            loadUsers()
        }
    }

    async function handleUpdateUser() {
        if (!editingUser) return

        const { error } = await supabase
            .from('system_users')
            .update(formData)
            .eq('id', editingUser.id)

        if (error) {
            toast({ title: 'Erro ao atualizar usuário', variant: 'destructive' })
        } else {
            toast({ title: 'Usuário atualizado!' })
            setEditingUser(null)
            resetForm()
            loadUsers()
        }
    }

    async function handleToggleActive(user: SystemUser) {
        const { error } = await supabase
            .from('system_users')
            .update({ is_active: !user.is_active })
            .eq('id', user.id)

        if (error) {
            toast({ title: 'Erro ao alterar status', variant: 'destructive' })
        } else {
            toast({ title: user.is_active ? 'Usuário desativado' : 'Usuário ativado' })
            loadUsers()
        }
    }

    async function handleDeleteUser(user: SystemUser) {
        if (!confirm(`Tem certeza que deseja excluir ${user.name}?`)) return

        const { error } = await supabase
            .from('system_users')
            .delete()
            .eq('id', user.id)

        if (error) {
            toast({ title: 'Erro ao excluir usuário', variant: 'destructive' })
        } else {
            toast({ title: 'Usuário excluído' })
            loadUsers()
        }
    }

    function resetForm() {
        setFormData({ name: '', email: '', role: 'viewer', department: '', phone: '' })
    }

    function openEditDialog(user: SystemUser) {
        setFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || '',
            phone: user.phone || ''
        })
        setEditingUser(user)
    }

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
        const matchesRole = roleFilter === 'all' || user.role === roleFilter
        return matchesSearch && matchesRole
    })

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Gestão de Usuários</CardTitle>
                            <CardDescription>
                                Gerencie os usuários do sistema e suas permissões
                            </CardDescription>
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={resetForm}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Novo Usuário
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                                    <DialogDescription>
                                        Preencha os dados do novo usuário
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Nome</label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Nome completo"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email</label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@empresa.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Papel</label>
                                        <Select
                                            value={formData.role}
                                            onValueChange={v => setFormData({ ...formData, role: v as SystemUser['role'] })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="manager">Gerente</SelectItem>
                                                <SelectItem value="editor">Editor</SelectItem>
                                                <SelectItem value="viewer">Visualizador</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Departamento</label>
                                        <Input
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                            placeholder="Ex: Financeiro"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Telefone</label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+34 600 000 000"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                                        Cancelar
                                    </Button>
                                    <Button onClick={handleCreateUser}>
                                        Criar Usuário
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filtros */}
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por nome ou email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filtrar por papel" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os papéis</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Gerente</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                                <SelectItem value="viewer">Visualizador</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lista de usuários */}
                    <div className="space-y-2">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Carregando...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhum usuário encontrado
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    className={`flex items-center justify-between p-4 border rounded-lg ${!user.is_active ? 'opacity-50 bg-gray-50' : 'bg-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <UserAvatar user={user} size="md" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">
                                                    {user.email === 'botella@system.local' ? (
                                                        <><strong>BOT</strong>ella</>
                                                    ) : (
                                                        user.name
                                                    )}
                                                </span>
                                                {!user.is_active && (
                                                    <Badge variant="outline" className="text-xs">Inativo</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                {user.email}
                                                {user.department && (
                                                    <>
                                                        <span>•</span>
                                                        {user.department}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Badge className={roleLabels[user.role]?.color}>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {roleLabels[user.role]?.label}
                                        </Badge>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                                    {user.is_active ? (
                                                        <>
                                                            <UserX className="h-4 w-4 mr-2" />
                                                            Desativar
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserCheck className="h-4 w-4 mr-2" />
                                                            Ativar
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDeleteUser(user)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Dialog de Edição */}
            <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Nome</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Papel</label>
                            <Select
                                value={formData.role}
                                onValueChange={v => setFormData({ ...formData, role: v as SystemUser['role'] })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="manager">Gerente</SelectItem>
                                    <SelectItem value="editor">Editor</SelectItem>
                                    <SelectItem value="viewer">Visualizador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Departamento</label>
                            <Input
                                value={formData.department}
                                onChange={e => setFormData({ ...formData, department: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdateUser}>
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
