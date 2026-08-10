import 'server-only';

import { createClient } from '@supabase/supabase-js';

// The service-role client: bypasses Row Level Security entirely by design.
// This is the ONLY client in the app allowed to read or act on moderated
// content (posts, comments, events, missions, services, reports, ...) --
// every real table's RLS denies the anon/authenticated roles this app's
// Supabase Auth session otherwise runs as. `import 'server-only'` makes any
// accidental import from a Client Component a build error, not a runtime
// leak of this key.
//
// Never instantiate this per-request from user input; it is a fixed,
// trusted server credential.
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY -- see .env.example.',
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
