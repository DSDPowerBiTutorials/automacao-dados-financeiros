"use client";

import { usePathname } from 'next/navigation';
import Sidebar from "@/components/custom/sidebar";
import { AuthGuard } from "@/components/auth/AuthGuard";

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
            <Sidebar />
            <main className="flex-1 min-h-screen transition-all duration-300 ease-in-out" style={{ marginLeft: 'var(--sidebar-width, 4rem)' }}>
                <div className="p-6">
                    <div className="bg-white rounded-3xl shadow-xl min-h-[calc(100vh-3rem)] p-8">
                        {children}
                    </div>
                </div>
            </main>
        </AuthGuard>
    );
}
