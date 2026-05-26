import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { ROUTE_ROLES, PUBLIC_ROUTES } from '@/lib/nav-config';

function redirectToLogin(req: NextRequest, reason: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('reason', reason);
  if (reason === 'unauthorized') {
    url.searchParams.set('next', req.nextUrl.pathname);
  }
  return NextResponse.redirect(url);
}

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('access_token')?.value;
  if (!token) return redirectToLogin(req, 'unauthorized');

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'workforce-jwt-secret-change-in-production',
    );
    const { payload } = await jwtVerify(token, secret);
    const roles = (payload.roles as string[]) ?? [];

    const requiredRoles = Object.entries(ROUTE_ROLES).find(([prefix]) =>
      pathname.startsWith(prefix),
    )?.[1];

    if (requiredRoles && !requiredRoles.some((r) => roles.includes(r))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  } catch {
    return redirectToLogin(req, 'expired');
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
