'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/user-avatar'
import { useAuth } from '@/contexts/auth-context'
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
    ChevronLeft,
    HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const settingsNav = [
    { title: 'My Profile', href: '/settings/profile', icon: User },
    { title: 'Users', href: '/settings/users', icon: Users, adminOnly: true },
    { title: 'Roles & Permissions', href: '/settings/roles', icon: Shield, adminOnly: true },
    { title: 'BOTella', href: '/settings/botella', icon: Bot },
    { title: 'Audit', href: '/settings/audit', icon: ClipboardList, adminOnly: true },
    { title: 'Notifications', href: '/settings/notifications', icon: Bell },
    { title: 'Security', href: '/settings/security', icon: Lock },
    { title: 'Integrations', href: '/settings/integrations', icon: Plug, adminOnly: true },
    { title: 'Drive', href: '/settings/drive', icon: HardDrive },
    { title: 'System', href: '/settings/system', icon: Settings, adminOnly: true },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { profile } = useAuth()
    const isAdmin = profile?.role === 'admin'

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
                                    Back
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-xl font-semibold">Settings</h1>
                                <p className="text-sm text-muted-foreground">
                                    Manage your account and system preferences
                                </p>
                            </div>
                        </div>
                        <UserAvatar user={profile ? { email: profile.email, name: profile.name, avatar_url: profile.avatar_url } : { email: '', name: '' }} size="md" showTooltip />
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
