const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

interface RateLimitEntry {
  count: number;
  windowStartedAt: number;
}

const entries = new Map<string, RateLimitEntry>();

export function allowAssistantRequest(
  userId: string,
  now = Date.now(),
): boolean {
  const current = entries.get(userId);
  if (!current || now - current.windowStartedAt >= WINDOW_MS) {
    entries.set(userId, { count: 1, windowStartedAt: now });
    return true;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  return true;
}

export const resetAssistantRateLimit = (): void => {
  entries.clear();
};

export const assistantRateLimit = {
  maxRequests: MAX_REQUESTS_PER_WINDOW,
  windowMs: WINDOW_MS,
};
