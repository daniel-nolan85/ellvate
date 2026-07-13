import { verifyToken } from '@clerk/backend';

import { DEMO_USER_ID } from '@/src/backend/store';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

// Resolves the caller's user id from a Clerk session token.
//
// When CLERK_SECRET_KEY is configured, the bearer token is cryptographically
// verified against Clerk's JWKS and the real Clerk user id (the `sub` claim) is
// returned. Without a secret key (local/dev, or auth left disabled) or without a
// valid token, the caller is treated as the anonymous demo user so the app stays
// functional. An invalid or expired token also degrades to the demo user rather
// than being trusted — it never grants access to another identity's data.
export async function getRequestUserId(request: Request): Promise<string> {
  const token = request.headers
    .get('authorization')
    ?.match(BEARER_PATTERN)?.[1]
    ?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!token || !secretKey) {
    return DEMO_USER_ID;
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    return typeof payload.sub === 'string' && payload.sub.length > 0
      ? payload.sub
      : DEMO_USER_ID;
  } catch {
    return DEMO_USER_ID;
  }
}
