'use client'

import { UserAvatar } from './user-avatar'
import { cn } from '@/lib/utils'

interface User {
    email?: string | null
    name?: string | null
    id?: string | null
    avatar_url?: string | null
}

interface UserAvatarGroupProps {
    users: User[]
    max?: number
    size?: 'xs' | 'sm' | 'md' | 'lg'
    className?: string
}

const sizeClasses = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
}

export function UserAvatarGroup({ users, max = 4, size = 'sm', className }: UserAvatarGroupProps) {
    const displayUsers = users.slice(0, max)
    const remaining = users.length - max

    if (users.length === 0) {
        return null
    }

    return (
        <div className={cn('flex -space-x-2', className)}>
            {displayUsers.map((user, index) => (
                <UserAvatar
                    key={user.id || user.email || index}
                    user={user}
                    size={size}
                    showTooltip
                    className="hover:z-10 transition-transform hover:scale-110"
                />
            ))}
            {remaining > 0 && (
                <div
                    className={cn(
                        'flex items-center justify-center rounded-full',
                        'bg-gray-100 dark:bg-gray-700',
                        'ring-2 ring-white dark:ring-gray-900',
                        'text-gray-600 dark:text-gray-300 font-medium',
                        sizeClasses[size]
                    )}
                    title={`+${remaining} mais`}
                >
                    +{remaining}
                </div>
            )}
        </div>
    )
}
