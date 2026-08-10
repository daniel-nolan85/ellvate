import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { isAllowedAdminEmail } from './lib/auth';

const PUBLIC_PATHS = ['/login', '/auth/callback'];

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

export async function middleware(request: NextRequest) {
  // Public paths never touch Supabase at all -- this both avoids doing
  // pointless auth work on the login page itself, and means the login page
  // still renders locally before a real Supabase project/env vars exist.
  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );
  if (isPublicPath) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: readonly CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Checked on every request, not just at sign-in, so removing someone from
  // dashboard_admins takes effect immediately rather than waiting for their
  // session to expire (see the migration's comment for why this table has
  // no self-service path).
  const allowed = await isAllowedAdminEmail(user.email);
  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL('/login?error=not_allowed', request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
