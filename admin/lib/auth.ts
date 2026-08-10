import 'server-only';

import { createSupabaseAdminClient } from './supabase/admin';

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
