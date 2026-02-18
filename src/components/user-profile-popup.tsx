'use client'

import { useState } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/user-avatar'
import { MessageSquare, Mail, Building2, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface UserProfilePopupProps {
    user: {
        id?: string | null
        email?: string | null
        name?: string | null
        avatar_url?: string | null
        department?: string | null
        role?: string | null
        company_code?: string | null
    }
    children: React.ReactNode
    showDMButton?: boolean
    side?: 'top' | 'right' | 'bottom' | 'left'
    align?: 'start' | 'center' | 'end'
}

export function UserProfilePopup({
    user,
    children,
    showDMButton = true,
    side = 'right',
    align = 'start'
}: UserProfilePopupProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const handleSendDM = () => {
        if (!user.id) return

        // Navega para o chat com esse usuário
        router.push(`/chat?dm=${user.id}`)
        setOpen(false)
    }

    const getRoleLabel = (role: string | null | undefined) => {
        const labels: Record<string, string> = {
            admin: 'Administrador',
            finance_manager: 'Gerente Financeiro',
            analyst: 'Analista',
            viewer: 'Visualizador',
        }
        return labels[role || ''] || role || 'Membro'
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="cursor-pointer hover:opacity-80 transition-opacity focus:outline-none"
                >
                    {children}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side={side}
                align={align}
                className="w-72 p-0"
                sideOffset={8}
            >
                {/* Header com avatar grande */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 p-4 border-b dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <UserAvatar user={user} size="lg" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white truncate">
                                {user.name || 'Usuário'}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                                {user.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Detalhes */}
                <div className="p-3 space-y-2">
                    {user.role && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Shield className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{getRoleLabel(user.role)}</span>
                        </div>
                    )}
                    {user.department && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{user.department}</span>
                        </div>
                    )}
                    {user.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="truncate">{user.email}</span>
                        </div>
                    )}
                </div>

                {/* Ações */}
                {showDMButton && user.id && (
                    <div className="border-t p-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={handleSendDM}
                        >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Enviar Mensagem
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
