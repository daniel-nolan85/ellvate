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
// This project uses Supabase's PKCE flow (confirmed from an actual email:
// the link is /auth/v1/verify?token=pkce_...&type=magiclink), so the emailed
// link's token can't be verified directly via verifyOtp() the way a plain
// OTP code could -- PKCE only completes through the redirect-based
// code exchange. emailRedirectTo is still set here in case the link ever
// works again once Auth > URL Configuration is reachable, but since nobody
// on this team has dashboard access to fix the Site URL, it currently
// always redirects to localhost regardless of this value. The login page's
// actual working flow has the admin click the link anyway, copy the `code`
// param off the resulting (failed-to-load) localhost URL, and paste it back
// in -- see admin/app/login/page.tsx and the existing /auth/callback route,
// which already does exchangeCodeForSession(code) and needs no changes.
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
