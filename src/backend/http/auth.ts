import { verifyToken } from '@clerk/backend';

import { DEMO_USER_ID } from '@/src/backend/store';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export type RequestAuthErrorCode = 'auth_required' | 'auth_unavailable';

export class RequestAuthError extends Error {
  readonly code: RequestAuthErrorCode;
  readonly status: 401 | 503;

  constructor(code: RequestAuthErrorCode, message: string, status: 401 | 503) {
    super(message);
    this.name = 'RequestAuthError';
    this.code = code;
    this.status = status;
  }
}

export const getBackendAuthMode = (): 'clerk' | 'demo' => {
  const configured = process.env.BACKEND_AUTH_MODE?.trim();
  if (configured === 'demo') {
    return 'demo';
  }
  if (configured === 'clerk') {
    return 'clerk';
  }

  // Disabled public auth is the explicit local/demo contract. Every other
  // environment must opt into Clerk verification rather than silently
  // receiving a shared demo identity.
  return process.env.EXPO_PUBLIC_AUTH_MODE === 'disabled' ? 'demo' : 'clerk';
};

// Resolves the caller's user id from a Clerk session token.
//
// Demo identity access is explicit and limited to the disabled/demo backend
// mode. Clerk mode fails closed for missing configuration, missing credentials,
// invalid tokens, and tokens without a subject.
export async function getRequestUserId(request: Request): Promise<string> {
  if (getBackendAuthMode() === 'demo') {
    return DEMO_USER_ID;
  }

  const token = request.headers
    .get('authorization')
    ?.match(BEARER_PATTERN)?.[1]
    ?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    throw new RequestAuthError(
      'auth_unavailable',
      'Authentication is not configured for this environment.',
      503,
    );
  }

  if (!token) {
    throw new RequestAuthError(
      'auth_required',
      'A valid authentication token is required.',
      401,
    );
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new RequestAuthError(
        'auth_required',
        'The authentication token has no user identity.',
        401,
      );
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof RequestAuthError) {
      throw error;
    }
    // TEMPORARY: the hosting platform's dashboard isn't surfacing
    // console.error output, so the real verifyToken failure reason is
    // included directly in the client-visible message for one round of
    // debugging. Revert to a generic message once diagnosed -- see
    // https://github.com/norez-solutions/llv-community-app/pull/42.
    const detail = error instanceof Error ? error.message : String(error);
    throw new RequestAuthError(
      'auth_required',
      `The authentication token is invalid or expired. [debug: ${detail}]`,
      401,
    );
  }
}
