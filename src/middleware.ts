import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
    const res = NextResponse.next();
    const supabase = createMiddlewareClient({ req, res });

    const {
        data: { session },
    } = await supabase.auth.getSession();

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

    // Allow public routes
    if (isPublicRoute) {
        // If already logged in, redirect to dashboard
        if (session) {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }
        return res;
    }

    // Protect all other routes
    if (!session) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Check if user profile exists and is active
    const { data: user } = await supabase
        .from('users')
        .select('is_active, role')
        .eq('id', session.user.id)
        .single();

    if (!user || !user.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login?error=inactive', req.url));
    }

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - api routes (handled separately)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
