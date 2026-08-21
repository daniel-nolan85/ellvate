import 'server-only';

import { createSupabaseAdminClient } from './supabase/admin';
import { createSupabaseServerClient } from './supabase/server';

// dashboard_admins has no anon/authenticated grants at all (see the
// migration), so this check always goes through the service-role client --
// there's no "ask the DB as the signed-in user" path here even if we wanted
// one.
export async function isAllowedAdminEmail(email: string): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('dashboard_admins')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data !== null;
}

// Non-redirecting identity lookup for page/layout render context --
// `requireAdminEmail()` in actions.ts calls `redirect()`, which is only
// valid inside a Server Action, not a Server Component render. Middleware
// already gates every route, so a null here (no session) is defensive only.
export async function getCurrentAdminEmail(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() ?? null;
}
