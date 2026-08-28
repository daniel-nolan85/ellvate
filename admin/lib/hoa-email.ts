// HOA board email for succeeded petitions. Deliberately NOT automatic --
// see the "Send to HOA board" action on the petition detail page. An admin
// reviews (and can edit) the generated draft before it goes out, since
// unlike everything else this dashboard moderates, an email to the actual
// board can't be unsent.
//
// The tone is intentionally a respectful request for consideration, not a
// demand -- the goal of this feature is to give residents a heard voice
// while keeping the app's relationship with volunteer HOA boards a good
// one, not to create a venue for residents to fight with them.
//
// Best-effort, mirrors web/lib/email/send-notification.ts's and the mobile
// app's now-removed src/backend/petitions/email.ts's identical no-op-until-
// configured pattern, with its own env vars (this is a separate process).

export interface HoaEmailTemplate {
  readonly subject: string;
  readonly body: string;
}

export function buildHoaEmailTemplate(petition: {
  readonly title: string;
  readonly description: string;
  readonly signatureCount: number;
}): HoaEmailTemplate {
  return {
    body: `Hello,

We're reaching out to share feedback from residents. A petition titled "${petition.title}" was created within the community platform and has received ${petition.signatureCount} signatures from residents.

${petition.description}

We've shared this petition for your consideration. We understand that any changes are subject to the HOA's existing policies and procedures, and we're simply hoping to provide the board with a clear representation of resident sentiment.

Thank you for taking the time to consider this feedback.`,
    subject: `Community Feedback — ${petition.title}`,
  };
}

export async function sendHoaEmail(subject: string, body: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PETITIONS_FROM_EMAIL;
  const to = process.env.HOA_NOTIFY_EMAIL;

  if (!apiKey || !from || !to) {
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text: body }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
