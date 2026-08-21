import 'server-only';

import { sendNotificationEmail } from '@/lib/email/send-notification';
import { createSupabaseClient } from '@/lib/supabase/client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type SendContactMessageResult = { ok: true } | { ok: false; error: string };

export async function sendContactMessage({
  name,
  email,
  subject,
  message,
}: ContactInput): Promise<SendContactMessageResult> {
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();

  if (!trimmedName) {
    return { ok: false, error: 'Enter your name.' };
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!trimmedSubject) {
    return { ok: false, error: 'Enter a subject.' };
  }
  if (!trimmedMessage) {
    return { ok: false, error: 'Enter a message.' };
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from('landing_contact_messages').insert({
    name: trimmedName,
    email: trimmedEmail,
    subject: trimmedSubject,
    message: trimmedMessage,
  });

  if (error) {
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  await sendNotificationEmail(
    `[${trimmedSubject}] New contact message from ${trimmedName}`,
    `${trimmedMessage}\n\nReply to: ${trimmedEmail}`
  );

  return { ok: true };
}
