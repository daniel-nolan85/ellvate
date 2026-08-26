'use server';

import { isAllowedAdminEmail } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RequestCodeResult =
  | { ok: true }
  | { ok: false; reason: 'not_allowed' | 'rate_limited' | 'error' };

type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'not_allowed' | 'error' };

// Gates the send on the allowlist first -- unlike Supabase's own "allow new
// signups" toggle, this always returns a distinct reason so the UI can be
// honest with non-admins instead of claiming a code was sent.
//
// Deliberately no `emailRedirectTo`: this flow never follows a link, only
// the numeric code Supabase includes in the same templated email (the
// {{ .Token }} value -- confirm it's actually in the "Magic Link" template
// under Authentication > Email Templates, since Supabase's default template
// only shows the link). Verifying the code directly sidesteps the whole
// redirect/Site-URL configuration that made the old link-based flow
// unreliable.
export async function requestSignInCode(email: string): Promise<RequestCodeResult> {
  const allowed = await isAllowedAdminEmail(email);
  if (!allowed) {
    return { ok: false, reason: 'not_allowed' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    // Logged (not just swallowed) so a failure is visible in Vercel's
    // Runtime Logs without needing a local repro.
    console.error(`[login] signInWithOtp failed for ${email}:`, error.code, error.message);

    if (error.code === 'over_email_send_rate_limit') {
      return { ok: false, reason: 'rate_limited' };
    }
    return { ok: false, reason: 'error' };
  }

  return { ok: true };
}

// Verifying the emailed code establishes the session directly (sets the
// auth cookie via the server client) -- no redirect/callback route needed.
export async function verifySignInCode(email: string, code: string): Promise<VerifyCodeResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });

  if (error) {
    console.error(`[login] verifyOtp failed for ${email}:`, error.code, error.message);
    return { ok: false, reason: 'invalid' };
  }

  // The session is valid the moment verifyOtp succeeds, but this address
  // could have been removed from dashboard_admins in the time between
  // requesting and entering the code -- re-check rather than trusting the
  // earlier gate (middleware would catch this on the next request anyway,
  // but failing here avoids a confusing flash of the dashboard first).
  const allowed = await isAllowedAdminEmail(email);
  if (!allowed) {
    await supabase.auth.signOut();
    return { ok: false, reason: 'not_allowed' };
  }

  return { ok: true };
}
