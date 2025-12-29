import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some(route => req.nextUrl.pathname.startsWith(route));

    // For now, allow all routes - authentication will be handled by AuthContext client-side
    // This is necessary because Supabase auth-helpers-nextjs is deprecated
    // and edge runtime has limitations with Supabase client

    return NextResponse.next();
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
