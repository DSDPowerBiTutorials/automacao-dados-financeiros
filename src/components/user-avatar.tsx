'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getAvatarUrl, getInitials, getAvatarColor, isBotella } from '@/lib/avatars'

interface UserAvatarProps {
    user: {
        email?: string | null
        name?: string | null
        id?: string | null
        avatar_url?: string | null
    } | null
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    className?: string
    showTooltip?: boolean
    showOnlineIndicator?: boolean
}

const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg'
}

const imageSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64
}

const indicatorSizes = {
    xs: 'h-2 w-2 border',
    sm: 'h-2.5 w-2.5 border-2',
    md: 'h-3 w-3 border-2',
    lg: 'h-3.5 w-3.5 border-2',
    xl: 'h-4 w-4 border-2'
}

export function UserAvatar({
    user,
    size = 'md',
    className,
    showTooltip = false,
    showOnlineIndicator = false
}: UserAvatarProps) {
    const [imgError, setImgError] = useState(false)

    const identifier = user?.email || user?.name || user?.id
    const avatarUrl = user?.avatar_url || getAvatarUrl(identifier)
    const initials = getInitials(user?.name || user?.email)
    const displayName = user?.name || user?.email || 'Usuário'
    const colorClass = getAvatarColor(user?.name || user?.email)
    const isBot = isBotella(identifier)

    const containerClasses = cn(
        'relative rounded-full overflow-hidden flex items-center justify-center font-medium',
        'ring-2 ring-white dark:ring-gray-900 shadow-sm',
        !imgError && avatarUrl ? 'bg-gray-200' : `bg-gradient-to-br ${colorClass} text-white`,
        sizeClasses[size],
        className
    )

    const renderContent = () => {
        if (!imgError && avatarUrl) {
            return (
                <Image
                    src={avatarUrl}
                    alt={displayName}
                    width={imageSizes[size]}
                    height={imageSizes[size]}
                    className="object-cover w-full h-full"
                    onError={() => setImgError(true)}
                    unoptimized={avatarUrl.endsWith('.svg')}
                />
            )
        }

        return (
            <span className="select-none">
                {initials}
            </span>
        )
    }

    const renderIndicator = () => {
        if (!showOnlineIndicator && !isBot) return null

        return (
            <span
                className={cn(
                    'absolute bottom-0 right-0 rounded-full border-white',
                    isBot ? 'bg-green-500' : 'bg-gray-400',
                    indicatorSizes[size]
                )}
            />
        )
    }

    if (showTooltip) {
        return (
            <div className="group relative inline-block">
                <div className={containerClasses}>
                    {renderContent()}
                    {renderIndicator()}
                </div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {isBot ? (
                        <span><strong>BOT</strong>ella</span>
                    ) : (
                        displayName
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={containerClasses}>
            {renderContent()}
            {renderIndicator()}
        </div>
    )
}

/**
 * Componente para exibir o nome BOTella com formatação
 */
export function BotName({ className }: { className?: string }) {
    return (
        <span className={className}>
            <strong className="font-bold">BOT</strong>ella
        </span>
    )
}
