import { createBrowserClient } from '@supabase/ssr';

// Client-side anon client, used only by the login page to request a magic
// link. Never used to read/write moderated content.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
