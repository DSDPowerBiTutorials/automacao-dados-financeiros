"use client";

import { useAuth, usePermission, useRole } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
    children: React.ReactNode;
    requiredRole?: string | string[];
    requiredPermission?: string;
    fallback?: React.ReactNode;
    redirectTo?: string;
}

export function RoleGuard({
    children,
    requiredRole,
    requiredPermission,
    fallback,
    redirectTo = '/dashboard'
}: RoleGuardProps) {
    const { profile, loading } = useAuth();
    const router = useRouter();
    const hasRole = useRole(requiredRole || '');
    const hasPermission = usePermission(requiredPermission || '');

    useEffect(() => {
        if (!loading && !profile) {
            router.push('/login');
        }
    }, [loading, profile, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-[#243140]" />
            </div>
        );
    }

    if (!profile) {
        return null;
    }

    // Check role requirement
    if (requiredRole && !hasRole) {
        if (redirectTo) {
            router.push(redirectTo);
            return null;
        }
        return fallback ? <>{fallback}</> : (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600">You don&apos;t have permission to access this page.</p>
                </div>
            </div>
        );
    }

    // Check permission requirement
    if (requiredPermission && !hasPermission) {
        if (redirectTo) {
            router.push(redirectTo);
            return null;
        }
        return fallback ? <>{fallback}</> : (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600">You don&apos;t have the required permission.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

// Simplified permission component for inline use
export function RequirePermission({
    permission,
    children,
    fallback
}: {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const hasPermission = usePermission(permission);

    if (!hasPermission) {
        return fallback ? <>{fallback}</> : null;
    }

    return <>{children}</>;
}

// Simplified role component for inline use
export function RequireRole({
    role,
    children,
    fallback
}: {
    role: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode;
}) {
    const hasRole = useRole(role);

    if (!hasRole) {
        return fallback ? <>{fallback}</> : null;
    }

    return <>{children}</>;
}
