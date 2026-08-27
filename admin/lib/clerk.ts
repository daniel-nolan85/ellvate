// Clerk Backend API calls used only when an admin deletes a member's
// account -- looking up their email to notify them, and banning their
// Clerk identity so deletion is a real removal rather than something they
// can undo by just signing back in (ensureUser() upserts a fresh app_users
// row for any authenticated Clerk id with no row yet). Best-effort: no-ops
// if CLERK_SECRET_KEY isn't set, same pattern as the Resend helpers in this
// directory -- a moderator can still delete a user's content even before
// this is configured, they just won't get the ban/email on top.

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

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// Returns null if Clerk isn't configured, the user has no email on file, or
// the lookup fails for any reason (e.g. the Clerk account itself was
// already removed) -- the caller treats all of these the same way: skip
// the notification email, still proceed with deleting the app_users row.
export async function getClerkUserEmail(userId: string): Promise<string | null> {
  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch(`${CLERK_API_BASE}/users/${userId}`, {
      headers: authHeaders(apiKey),
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

// Blocks the Clerk identity from signing in again -- reversible from the
// Clerk dashboard (Users -> the account -> Unban) if a deletion needs to be
// undone. Returns whether the ban actually took effect; the caller doesn't
// fail the surrounding delete over this either way.
export async function banClerkUser(userId: string): Promise<boolean> {
  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${CLERK_API_BASE}/users/${userId}/ban`, {
      headers: authHeaders(apiKey),
      method: 'POST',
    });
    return response.ok;
  } catch {
    return false;
  }
}
