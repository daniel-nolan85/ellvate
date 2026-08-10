import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options: CookieOptions;
}

// Anon-key client bound to the request's Supabase Auth session cookies --
// this is ONLY for knowing who's signed in (magic-link session), never for
// reading/writing moderated content. RLS on every real table denies
// anon/authenticated entirely (see supabase/migrations/0028_dashboard_admins.sql
// and the moderation migrations in ../../supabase) -- content access always
// goes through the service-role client in admin.ts.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: readonly CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component -- middleware refreshes the
            // session cookie on every request, so a failed set here is safe
            // to ignore (see the Supabase SSR docs' standard caveat).
          }
        },
      },
    },
  );
}
