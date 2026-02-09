"use client";

import { usePathname } from 'next/navigation';
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TablerAppShell } from "@/components/tabler/TablerAppShell";
import { PlatformChat } from "@/components/app/platform-chat";

export function LayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Public routes that don't show sidebar
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

    // Workstream has its own independent layout (no Finance Hub shell)
    const isWorkstreamRoute = pathname?.startsWith('/workstream');

    if (isPublicRoute) {
        return <AuthGuard>{children}</AuthGuard>;
    }

    if (isWorkstreamRoute) {
        return (
            <AuthGuard>
                {children}
                <PlatformChat />
            </AuthGuard>
        );
    }

    return (
        <AuthGuard>
            <TablerAppShell>{children}</TablerAppShell>
            <PlatformChat />
        </AuthGuard>
    );
}
