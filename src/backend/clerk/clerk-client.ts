// Clerk Backend API lookups used from the main app backend (distinct from
// admin/lib/clerk.ts, which lives in the separate admin Next.js app and
// can't be imported across the app boundary). Currently used only for the
// business-listing domain-match verification tier: comparing a listing
// creator's actual account email against the business's own claimed
// website domain. Best-effort, same posture as admin/lib/clerk.ts's own
// helpers -- no-ops if CLERK_SECRET_KEY isn't set (e.g. demo/memory auth
// mode), and any failure just means that half of the domain-match check
// can't run, not that listing creation fails.

const CLERK_API_BASE = 'https://api.clerk.com/v1';

interface ClerkEmailAddress {
  readonly id: string;
  readonly email_address: string;
}

interface ClerkUser {
  readonly id: string;
  readonly primary_email_address_id: string | null;
  readonly email_addresses: readonly ClerkEmailAddress[];
}

// Returns null if Clerk isn't configured, the account has no email on
// file, or the lookup fails for any reason.
export async function getAccountEmail(userId: string): Promise<string | null> {
  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${CLERK_API_BASE}/users/${userId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return null;
    }
    const user = (await response.json()) as ClerkUser;
    const primary = user.email_addresses.find(
      (address) => address.id === user.primary_email_address_id,
    );
    return primary?.email_address ?? user.email_addresses[0]?.email_address ?? null;
  } catch {
    return null;
  }
}
