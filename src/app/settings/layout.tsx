'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/user-avatar'
import {
    User,
    Users,
    Shield,
    Bot,
    ClipboardList,
    Bell,
    Lock,
    Plug,
    Settings,
    ChevronLeft
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const settingsNav = [
    { title: 'Meu Perfil', href: '/settings/profile', icon: User },
    { title: 'Usuários', href: '/settings/users', icon: Users, adminOnly: true },
    { title: 'Papéis & Permissões', href: '/settings/roles', icon: Shield, adminOnly: true },
    { title: 'BOTella', href: '/settings/botella', icon: Bot },
    { title: 'Auditoria', href: '/settings/audit', icon: ClipboardList, adminOnly: true },
    { title: 'Notificações', href: '/settings/notifications', icon: Bell },
    { title: 'Segurança', href: '/settings/security', icon: Lock },
    { title: 'Integrações', href: '/settings/integrations', icon: Plug, adminOnly: true },
    { title: 'Sistema', href: '/settings/system', icon: Settings, adminOnly: true },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    // TODO: Pegar usuário real do contexto de auth
    const currentUser = { email: 'fernando@dsd.com', name: 'Fernando', role: 'admin' }
    const isAdmin = currentUser.role === 'admin'

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black">
            {/* Header */}
            <div className="border-b bg-white dark:bg-black">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard">
                                <Button variant="ghost" size="sm">
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Voltar
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-semibold">Configurações</h1>
                                <p className="text-sm text-muted-foreground">
                                    Gerencie sua conta e preferências do sistema
                                </p>
                            </div>
                        </div>
                        <UserAvatar user={currentUser} size="md" showTooltip />
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6">
                <div className="flex gap-6">
                    {/* Sidebar */}
                    <aside className="w-64 shrink-0">
                        <nav className="space-y-1">
                            {settingsNav
                                .filter(item => !item.adminOnly || isAdmin)
                                .map(item => {
                                    const Icon = item.icon
                                    const isActive = pathname === item.href

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                                isActive
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            )}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {item.title}
                                        </Link>
                                    )
                                })}
                        </nav>
                    </aside>

                    {/* Content */}
                    <main className="flex-1 min-w-0">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
