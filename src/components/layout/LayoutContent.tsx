"use client";

import { usePathname } from 'next/navigation';
import { AuthGuard } from "@/components/auth/AuthGuard";
import { TablerAppShell } from "@/components/tabler/TablerAppShell";

export function LayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Public routes that don't show sidebar
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

    if (isPublicRoute) {
        return <AuthGuard>{children}</AuthGuard>;
    }

    return (
        <AuthGuard>
            <TablerAppShell>{children}</TablerAppShell>
        </AuthGuard>
    );
}
