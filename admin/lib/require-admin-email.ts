import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from './supabase/server';

// Server Actions are callable directly, not just through the rendered UI --
// so the acting admin's identity must come from their own session, never
// from a client-supplied argument (that would let anyone spoof who
// performed an action for the audit trail). Shared across every 'use server'
// action file rather than redefined per file, so there's exactly one place
// that decides what "signed in as an admin" means.
export async function requireAdminEmail(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect('/login');
  }
  return user.email;
}
