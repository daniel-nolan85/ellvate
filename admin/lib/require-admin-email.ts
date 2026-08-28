import { redirect } from 'next/navigation';

import { isAllowedAdminEmail } from './auth';
import { createSupabaseServerClient } from './supabase/server';

// Server Actions are callable directly, not just through the rendered UI --
// so the acting admin's identity must come from their own session, never
// from a client-supplied argument (that would let anyone spoof who
// performed an action for the audit trail). Shared across every 'use server'
// action file rather than redefined per file, so there's exactly one place
// that decides what "signed in as an admin" means. This mirrors
// middleware.ts's own check rather than trusting it alone: middleware only
// covers requests it matches, and a Server Action invoked directly (its own
// POST endpoint, not a page navigation) is exactly the kind of call this
// function's own doc comment above warns about -- being signed in to
// Supabase Auth at all isn't the same thing as being on dashboard_admins.
export async function requireAdminEmail(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect('/login');
  }
  if (!(await isAllowedAdminEmail(user.email))) {
    redirect('/login?error=not_allowed');
  }
  return user.email;
}
