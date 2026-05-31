import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET!
);

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Handle backward compatibility: redirect /affiliate/* to /association/*
    if (pathname.startsWith('/affiliate')) {
        const newPathname = pathname.replace(/^\/affiliate/, '/association');
        return NextResponse.redirect(new URL(newPathname, request.url));
    }
    if (pathname.startsWith('/api/affiliate')) {
        const newPathname = pathname.replace(/^\/api\/affiliate/, '/api/association');
        return NextResponse.redirect(new URL(newPathname, request.url));
    }

    // 1. Define protected routes
    const isAdminRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/admin');
    const isAssociationRoute = pathname.startsWith('/api/association') || pathname.startsWith('/association');

    if (!isAdminRoute && !isAssociationRoute) {
        return NextResponse.next();
    }

    // 2. Get token from cookies
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
        // If it's an API route, return 401
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }
        // If it's a page route, redirect to login
        return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
        // 3. Verify JWT
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userRole = payload.role as string;

        // 4. Role-based access control
        if (isAdminRoute && userRole !== 'ADMIN') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Forbidden: Admin access required' },
                    { status: 403 }
                );
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }

        if (isAssociationRoute && userRole !== 'ASSOCIATION' && userRole !== 'ADMIN') {
            if (pathname.startsWith('/api/')) {
                return NextResponse.json(
                    { error: 'Forbidden: Association access required' },
                    { status: 403 }
                );
            }
            return NextResponse.redirect(new URL('/login', request.url));
        }

        // 5. Inject user info into headers for API usage (optional but helpful)
        const response = NextResponse.next();
        response.headers.set('x-user-id', payload.userId as string);
        response.headers.set('x-user-role', userRole);

        return response;
    } catch (error) {
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        '/admin/:path*',
        '/association/:path*',
        '/affiliate/:path*', // backward compatibility
        '/api/admin/:path*',
        '/api/association/:path*',
        '/api/affiliate/:path*', // backward compatibility
        '/api/auth/me',
    ],
};
