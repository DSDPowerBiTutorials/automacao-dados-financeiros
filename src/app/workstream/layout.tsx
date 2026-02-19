'use client';

import { useState } from 'react';
import { WorkstreamHeader } from '@/components/workstream/WorkstreamHeader';
import { WorkstreamSidebar } from '@/components/workstream/WorkstreamSidebar';

export default function WorkstreamLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="h-screen flex flex-col bg-white dark:bg-black overflow-hidden">
            {/* Header */}
            <WorkstreamHeader
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                sidebarOpen={sidebarOpen}
            />

            {/* Body: Sidebar + Content */}
            <div className="flex flex-1 overflow-hidden">
                <WorkstreamSidebar
                    open={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                />

                {/* Main content */}
                <main className="flex-1 overflow-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
