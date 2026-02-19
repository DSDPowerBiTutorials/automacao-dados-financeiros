"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, profile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const hasRedirectedRef = useRef(false);

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => pathname?.startsWith(route));

    useEffect(() => {
        // Reset redirect flag when loading starts
        if (loading) {
            hasRedirectedRef.current = false;
            return;
        }

        // Prevent multiple redirects
        if (hasRedirectedRef.current) return;

        if (!user && !isPublicRoute) {
            // Not logged in and trying to access protected route
            hasRedirectedRef.current = true;
            router.replace('/login');
        } else if (user && profile?.is_active && isPublicRoute) {
            // Logged in with active profile and trying to access login page
            hasRedirectedRef.current = true;
            router.replace('/dashboard');
        }
    }, [user, loading, isPublicRoute, pathname, profile, router]);

    // Show loading screen while checking authentication
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#243140] mx-auto mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // If not logged in and trying to access protected route, show loading while redirecting
    if (!user && !isPublicRoute) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#243140] mx-auto mb-4" />
                    <p className="text-gray-600">Redirecting to login...</p>
                </div>
            </div>
        );
    }

    // If logged in but profile is inactive, show error message
    if (user && !isPublicRoute && profile && !profile.is_active) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
                <div className="text-center max-w-md p-8 bg-white dark:bg-black rounded-lg shadow-lg">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Account Inactive</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Your account is currently inactive.</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">Please contact your system administrator for assistance.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
