"use client";

import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

    useEffect(() => {
        if (!loading) {
            if (!user && !isPublicRoute) {
                // Not logged in and trying to access protected route
                router.push(`/login?redirectTo=${pathname}`);
            } else if (user && isPublicRoute) {
                // Logged in and trying to access login page
                router.push('/dashboard');
            }
        }
    }, [user, loading, isPublicRoute, pathname, router]);

    // Show loading screen while checking authentication
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[#243140]" />
            </div>
        );
    }

    // If not logged in and trying to access protected route, show nothing (will redirect)
    if (!user && !isPublicRoute) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[#243140]" />
            </div>
        );
    }

    return <>{children}</>;
}
