import 'server-only';

import { sendNotificationEmail } from '@/lib/email/send-notification';
import { createSupabaseClient } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type JoinWaitlistResult =
  | { ok: true; alreadyJoined: boolean }
  | { ok: false; error: string };

export async function joinWaitlist(rawEmail: string): Promise<JoinWaitlistResult> {
  const email = rawEmail.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from('waitlist_signups').insert({ email });

  if (error) {
    // 23505 = unique_violation -- already on the list, not a real failure.
    if (error.code === '23505') {
      return { ok: true, alreadyJoined: true };
    }
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  await sendNotificationEmail('New waitlist signup', `${email} joined the waitlist.`);

  return { ok: true, alreadyJoined: false };
}
