import 'server-only';

// Best-effort email forwarding for waitlist signups and contact messages.
// A no-op until RESEND_API_KEY, CONTACT_FROM_EMAIL, and CONTACT_NOTIFY_EMAIL
// are set -- which needs a purchased domain (to send from) and an inbox (to
// receive at), neither of which exist yet. Every submission is still saved
// to Supabase regardless, so nothing is lost while that's pending; this
// just adds an email on top once it's configured. See ../../.env.example.
export async function sendNotificationEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const to = process.env.CONTACT_NOTIFY_EMAIL;

  if (!apiKey || !from || !to) {
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
  } catch {
    // Never let a notification failure surface as a failure of the
    // user-facing form submission -- the row is already saved in Supabase.
  }
}
