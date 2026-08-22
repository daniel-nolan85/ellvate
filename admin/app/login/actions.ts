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
