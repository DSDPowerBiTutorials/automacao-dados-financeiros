'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
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
    Shield,
    Send,
    Loader2,
    Clock,
    CheckCircle2,
    Activity,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/ui/page-header'
import { UserActivityDialog } from '@/components/settings/UserActivityDialog'

interface AuthUser {
    id: string
    email: string
    name: string
    avatar_url?: string
    role: string
    company_code?: string
    department?: string
    phone?: string
    is_active: boolean
    last_login_at?: string
    created_at: string
}

const roleLabels: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-100 text-red-800' },
    finance_manager: { label: 'Finance Manager', color: 'bg-purple-100 text-purple-800' },
    analyst: { label: 'Analyst', color: 'bg-blue-100 text-blue-800' },
    viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-800' },
}

export default function UsersPage() {
    const { session } = useAuth()
    const [users, setUsers] = useState<AuthUser[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState<string>('all')
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
    const [activityUser, setActivityUser] = useState<AuthUser | null>(null)
    const { toast } = useToast()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'viewer',
        department: '',
        phone: '',
        company_code: 'GLOBAL',
    })

    useEffect(() => {
        loadUsers()
    }, [])

    async function loadUsers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('name')

        if (error) {
            toast({ title: 'Error loading users', variant: 'destructive' })
        } else {
            setUsers(data || [])
        }
        setLoading(false)
    }

    async function handleCreateUser() {
        if (!formData.name || !formData.email) {
            toast({ title: 'Name and email are required', variant: 'destructive' })
            return
        }

        setActionLoading('create')

        try {
            const res = await fetch('/api/auth/invite-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (!res.ok) {
                toast({ title: 'Error inviting user', description: data.error, variant: 'destructive' })
            } else {
                toast({ title: 'Invite sent!', description: `Invitation email sent to ${formData.email}` })
                setIsCreateOpen(false)
                resetForm()
                loadUsers()
            }
        } catch {
            toast({ title: 'Connection error', variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    async function handleUpdateUser() {
        if (!editingUser) return
        setActionLoading('update')

        const { error } = await supabase
            .from('users')
            .update({
                name: formData.name,
                role: formData.role,
                department: formData.department || null,
                phone: formData.phone || null,
                company_code: formData.company_code || 'GLOBAL',
            })
            .eq('id', editingUser.id)

        if (error) {
            toast({ title: 'Error updating user', variant: 'destructive' })
        } else {
            toast({ title: 'User updated!' })
            setEditingUser(null)
            resetForm()
            loadUsers()
        }
        setActionLoading(null)
    }

    async function handleToggleActive(user: AuthUser) {
        const { error } = await supabase
            .from('users')
            .update({ is_active: !user.is_active })
            .eq('id', user.id)

        if (error) {
            toast({ title: 'Error changing status', variant: 'destructive' })
        } else {
            toast({ title: user.is_active ? 'User deactivated' : 'User activated' })
            loadUsers()
        }
    }

    async function handleDeleteUser(user: AuthUser) {
        if (!confirm(`Are you sure you want to delete ${user.name}? This action permanently removes access to the system.`)) return

        setActionLoading(user.id)

        try {
            const res = await fetch('/api/auth/delete-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ userId: user.id }),
            })

            const data = await res.json()

            if (!res.ok) {
                toast({ title: 'Error deleting', description: data.error, variant: 'destructive' })
            } else {
                toast({ title: 'User deleted' })
                loadUsers()
            }
        } catch {
            toast({ title: 'Connection error', variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    async function handleResendInvite(user: AuthUser) {
        setActionLoading(user.id)

        try {
            const res = await fetch('/api/auth/invite-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    department: user.department,
                    phone: user.phone,
                    company_code: user.company_code,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                // If user already exists (409), it means they're already invited
                if (res.status === 409) {
                    toast({ title: 'User already exists', description: 'The invite was already sent previously', variant: 'destructive' })
                } else {
                    toast({ title: 'Error resending', description: data.error, variant: 'destructive' })
                }
            } else {
                toast({ title: 'Invite resent!', description: `New email sent to ${user.email}` })
            }
        } catch {
            toast({ title: 'Connection error', variant: 'destructive' })
        } finally {
            setActionLoading(null)
        }
    }

    function resetForm() {
        setFormData({ name: '', email: '', role: 'viewer', department: '', phone: '', company_code: 'GLOBAL' })
    }

    function openEditDialog(user: AuthUser) {
        setFormData({
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || '',
            phone: user.phone || '',
            company_code: user.company_code || 'GLOBAL',
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

    const hasLoggedIn = (user: AuthUser) => !!user.last_login_at

    return (
        <div className="space-y-6">
            <PageHeader title="User Management" subtitle="Manage team members, roles and authentication" />
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>
                                Invite users, manage permissions and control system access
                            </CardDescription>
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={resetForm}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Invite User
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Invite New User</DialogTitle>
                                    <DialogDescription>
                                        The user will receive an email with a link to create their password and access the system.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name *</label>
                                        <Input
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email *</label>
                                        <Input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="email@digitalsmiledesign.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Role</label>
                                        <Select
                                            value={formData.role}
                                            onValueChange={v => setFormData({ ...formData, role: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin">Admin</SelectItem>
                                                <SelectItem value="finance_manager">Finance Manager</SelectItem>
                                                <SelectItem value="analyst">Analyst</SelectItem>
                                                <SelectItem value="viewer">Viewer</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Department</label>
                                        <Input
                                            value={formData.department}
                                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                                            placeholder="Ex: Finance"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Phone</label>
                                        <Input
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+34 600 000 000"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Company Code</label>
                                        <Select
                                            value={formData.company_code}
                                            onValueChange={v => setFormData({ ...formData, company_code: v })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="GLOBAL">Global</SelectItem>
                                                <SelectItem value="ES">Spain (ES)</SelectItem>
                                                <SelectItem value="US">United States (US)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={actionLoading === 'create'}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleCreateUser} disabled={actionLoading === 'create'}>
                                        {actionLoading === 'create' ? (
                                            <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4 mr-2" />
                                                Send Invite
                                            </>
                                        )}
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
                                placeholder="Search by name or email..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Filtrar por role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="finance_manager">Finance Manager</SelectItem>
                                <SelectItem value="analyst">Analyst</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Lista de usuários */}
                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading...
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                No users found
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <div
                                    key={user.id}
                                    className={`flex items-center justify-between p-4 border rounded-lg ${!user.is_active ? 'opacity-50 bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-black'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <UserAvatar user={user} size="md" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{user.name}</span>
                                                {!user.is_active && (
                                                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                                                )}
                                                {!hasLoggedIn(user) && user.is_active && (
                                                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        Pending Invite
                                                    </Badge>
                                                )}
                                                {hasLoggedIn(user) && user.is_active && (
                                                    <Badge variant="outline" className="text-xs text-green-600 border-green-300 bg-green-50">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Active
                                                    </Badge>
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
                                                {user.company_code && user.company_code !== 'GLOBAL' && (
                                                    <>
                                                        <span>•</span>
                                                        {user.company_code}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Badge className={roleLabels[user.role]?.color || 'bg-gray-100 text-gray-800'}>
                                            <Shield className="h-3 w-3 mr-1" />
                                            {roleLabels[user.role]?.label || user.role}
                                        </Badge>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" disabled={actionLoading === user.id}>
                                                    {actionLoading === user.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setActivityUser(user)}>
                                                    <Activity className="h-4 w-4 mr-2" />
                                                    View Activity
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                                    {user.is_active ? (
                                                        <>
                                                            <UserX className="h-4 w-4 mr-2" />
                                                            Deactivate
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserCheck className="h-4 w-4 mr-2" />
                                                            Activate
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                {!hasLoggedIn(user) && (
                                                    <DropdownMenuItem onClick={() => handleResendInvite(user)}>
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Resend Invite
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={() => handleDeleteUser(user)}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
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
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update the user details. Email cannot be changed.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                type="email"
                                value={formData.email}
                                disabled
                                className="bg-gray-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <Select
                                value={formData.role}
                                onValueChange={v => setFormData({ ...formData, role: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="finance_manager">Finance Manager</SelectItem>
                                    <SelectItem value="analyst">Analyst</SelectItem>
                                    <SelectItem value="viewer">Viewer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Department</label>
                            <Input
                                value={formData.department}
                                onChange={e => setFormData({ ...formData, department: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Phone</label>
                            <Input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Company Code</label>
                            <Select
                                value={formData.company_code}
                                onValueChange={v => setFormData({ ...formData, company_code: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GLOBAL">Global</SelectItem>
                                    <SelectItem value="ES">Spain (ES)</SelectItem>
                                    <SelectItem value="US">United States (US)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)} disabled={actionLoading === 'update'}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateUser} disabled={actionLoading === 'update'}>
                            {actionLoading === 'update' ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* User Activity Dialog */}
            <UserActivityDialog
                userId={activityUser?.id || null}
                userName={activityUser?.name || ''}
                userEmail={activityUser?.email || ''}
                open={!!activityUser}
                onOpenChange={(open) => { if (!open) setActivityUser(null) }}
                accessToken={session?.access_token}
            />
        </div>
    )
}
