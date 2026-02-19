'use client';

import Link from 'next/link';
import Image from 'next/image';
import { UserMenu } from '@/components/auth/UserMenu';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Search, ArrowLeft, Menu } from 'lucide-react';
import { useState } from 'react';

interface WorkstreamHeaderProps {
    onToggleSidebar?: () => void;
    sidebarOpen?: boolean;
}

export function WorkstreamHeader({ onToggleSidebar }: WorkstreamHeaderProps) {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <header
            className="w-full flex-shrink-0"
            style={{
                background: '#1e1f21',
                borderBottom: '1px solid #333',
                height: 56,
            }}
        >
            <div className="h-full px-4 flex items-center justify-between">
                {/* Left: Back to Finance Hub + Logo */}
                <div className="flex items-center gap-3">
                    {/* Mobile sidebar toggle */}
                    <button
                        onClick={onToggleSidebar}
                        className="lg:hidden p-1.5 rounded hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    {/* Back to Finance Hub */}
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white hover:bg-white/10 transition-colors text-sm no-underline"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Finance Hub</span>
                    </Link>

                    {/* Divider */}
                    <div className="h-6 w-px bg-gray-100 dark:bg-[#0a0a0a]" />

                    {/* Logo */}
                    <Link href="/workstream" className="flex items-center gap-2.5 no-underline">
                        <Image
                            src="/favicon-32x32.png"
                            alt="DSD"
                            width={24}
                            height={24}
                            className="rounded"
                        />
                        <span
                            className="font-semibold text-base tracking-tight"
                            style={{
                                background: 'linear-gradient(135deg, #ffffff 0%, #60a5fa 100%)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            DSD Workstream
                        </span>
                    </Link>
                </div>

                {/* Center: Search */}
                <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tasks..."
                            className="w-full bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Right: Notifications + User */}
                <div className="flex items-center gap-2">
                    <NotificationBell />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
}
