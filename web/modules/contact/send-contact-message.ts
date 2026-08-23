import 'server-only';

import { sendNotificationEmail } from '@/lib/email/send-notification';
import { createSupabaseClient } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type SendContactMessageResult = { ok: true } | { ok: false; error: string };

export async function sendContactMessage({
  name,
  email,
  message,
}: ContactInput): Promise<SendContactMessageResult> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedMessage = message.trim();

  if (trimmedEmail && !EMAIL_PATTERN.test(trimmedEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!trimmedMessage) {
    return { ok: false, error: 'Enter a message.' };
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from('landing_contact_messages').insert({
    name: trimmedName || null,
    email: trimmedEmail || null,
    message: trimmedMessage,
  });

  if (error) {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  await sendNotificationEmail(
    `New contact message from ${trimmedName || 'an anonymous visitor'}`,
    trimmedEmail ? `${trimmedMessage}\n\nReply to: ${trimmedEmail}` : trimmedMessage
  );

  return { ok: true };
}
