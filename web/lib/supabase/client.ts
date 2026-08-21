import 'server-only';

import { createClient } from '@supabase/supabase-js';

// Server-side only, but deliberately the public anon key -- this site never
// needs the service-role key. Writes go through the `waitlist_signups`
// insert-only RLS policy (../../supabase/migrations/0033_waitlist_signups.sql),
// same as any other anon client would be allowed to do.
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured.');
  }

  return createClient(url, anonKey);
}
