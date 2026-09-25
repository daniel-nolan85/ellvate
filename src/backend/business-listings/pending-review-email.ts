// Notifies the admin when a new business listing needs manual review --
// same best-effort, no-op-until-configured Resend pattern as
// admin/lib/account-removed-email.ts, duplicated here (not imported) since
// this module runs in the mobile app's backend, a separate deployable from
// admin/. Recipient is a dedicated env var rather than a dashboard_admins
// lookup: that table grants no access to the anon/authenticated client this
// backend runs under (see supabase/migrations/0028_dashboard_admins.sql).

import type { BusinessListing } from './types';

function subject(listing: BusinessListing): string {
  return `Business listing pending review: ${listing.businessName}`;
}

function body(listing: BusinessListing): string {
  const reason =
    listing.verificationMethod === null
      ? 'automatic verification was inconclusive'
      : `verification method: ${listing.verificationMethod}`;
  return `A new business listing needs your review.

Business: ${listing.businessName}
Category: ${listing.category}
Submitted by: ${listing.author.name}
Reason: ${reason}

Review it in the admin dashboard's business listings queue.`;
}

export async function sendBusinessListingPendingReviewEmail(
  listing: BusinessListing,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ADMIN_FROM_EMAIL;
  const to = process.env.BUSINESS_LISTING_ADMIN_EMAIL;

  if (!apiKey || !from || !to) {
    console.warn(
      '[pending-review-email] skipped: missing env var(s):',
      [
        !apiKey && 'RESEND_API_KEY',
        !from && 'ADMIN_FROM_EMAIL',
        !to && 'BUSINESS_LISTING_ADMIN_EMAIL',
      ]
        .filter(Boolean)
        .join(', '),
    );
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject: subject(listing),
        text: body(listing),
      }),
    });
    if (!response.ok) {
      console.error(
        '[pending-review-email] Resend rejected the request:',
        response.status,
        await response.text().catch(() => '<no body>'),
      );
    }
    return response.ok;
  } catch (error) {
    // Best-effort -- the listing is already saved regardless of whether the
    // admin notification actually sends.
    console.error('[pending-review-email] fetch failed:', error);
    return false;
  }
}
