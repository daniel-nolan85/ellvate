// Notifies a member when an admin removes their account -- see
// hoa-email.ts for the identical best-effort, no-op-until-configured
// pattern this mirrors (its own separate env vars, since this is a
// different sender identity from the HOA-board-only emails).

const SUBJECT = 'Your eLLVate account has been removed';
const BODY = `Hello,

An eLLVate administrator has removed your account for violating our Terms of Service or Community Guidelines. Your posts, comments, and other content have been deleted along with it.

If you believe this was a mistake, reply to this email and we'll take a look.`;

export async function sendAccountRemovedEmail(to: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_FROM_EMAIL;

  if (!apiKey || !from) {
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject: SUBJECT, text: BODY }),
    });
    return response.ok;
  } catch {
    // Best-effort -- the account is already deleted regardless of whether
    // the notification actually sends.
    return false;
  }
}
