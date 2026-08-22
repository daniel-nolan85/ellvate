'use server';

import { headers } from 'next/headers';

import { isAllowedAdminEmail } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type RequestMagicLinkResult =
  | { ok: true }
  | { ok: false; reason: 'not_allowed' | 'error' };

// Gates the send on the allowlist first -- unlike Supabase's own "allow new
// signups" toggle, this always returns a distinct reason so the UI can be
// honest with non-admins instead of claiming a link was sent.
//
// emailRedirectTo is still set (in case the clickable link ever works again
// once the project's Auth > URL Configuration is reachable), but the login
// page's primary flow is the 6-digit code below, which needs no redirect
// allowlist at all -- Supabase's own Site URL fallback is what currently
// sends the link to localhost, and nobody on this team has dashboard access
// to fix that. See admin/app/login/page.tsx.
export async function requestMagicLink(email: string): Promise<RequestMagicLinkResult> {
  const allowed = await isAllowedAdminEmail(email);
  if (!allowed) {
    return { ok: false, reason: 'not_allowed' };
  }

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = host?.startsWith('localhost') ? 'http' : 'https';

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${protocol}://${host}/auth/callback` },
  });

  return error ? { ok: false, reason: 'error' } : { ok: true };
}

type VerifyCodeResult = { ok: true } | { ok: false };

// Verifies the 6-digit code from the same email signInWithOtp sent, and
// establishes the session directly -- no redirect/URL matching involved, so
// this works regardless of the project's Site URL configuration.
export async function verifyMagicLinkCode(
  email: string,
  token: string,
): Promise<VerifyCodeResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  return { ok: !error };
}
