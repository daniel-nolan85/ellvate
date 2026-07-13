import { DEMO_USER_ID } from '@/src/backend/store';

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export async function getRequestUserId(request: Request): Promise<string> {
  const token = request.headers
    .get('authorization')
    ?.match(BEARER_PATTERN)?.[1]
    ?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY;

  if (!token || !secretKey) {
    return DEMO_USER_ID;
  }

  // WHY: @clerk/backend is not installed in this repo yet, so verification cannot run.
  // Activation path: `bun add @clerk/backend`, then replace this fallback with
  // `const { verifyToken } = await import('@clerk/backend');` and return
  // `(await verifyToken(token, { secretKey })).sub`, falling back to DEMO_USER_ID on failure.
  return DEMO_USER_ID;
}
