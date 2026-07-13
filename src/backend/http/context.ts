import type { SupabaseClient } from '@supabase/supabase-js';

import { createRequestClientFor, getRequestClerkToken } from '@/src/services/supabase';

import { getRequestUserId } from './auth';

// Per-request backend context. `supabase` is non-null only when Supabase is
// configured; the client already carries the caller's Clerk token so RLS applies.
// When it is null the domain falls back to the in-memory store (tests / no-DB dev).
export interface RequestContext {
  readonly userId: string;
  readonly token: string | null;
  readonly supabase: SupabaseClient | null;
}

export async function createRequestContext(
  request: Request,
): Promise<RequestContext> {
  const userId = await getRequestUserId(request);
  return {
    supabase: createRequestClientFor(request),
    token: getRequestClerkToken(request),
    userId,
  };
}

// Context for the in-memory backend (unit tests).
export const memoryContext = (userId: string): RequestContext => ({
  supabase: null,
  token: null,
  userId,
});
