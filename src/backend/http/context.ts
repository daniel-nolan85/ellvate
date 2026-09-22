import type { SupabaseClient } from '@supabase/supabase-js';

import { MediaValidationError } from '@/src/backend/media';
import {
  assertServerRuntimeEnvironmentConfigured,
  ServerEnvironmentError,
} from '@/src/platform/environment/server-environment';
import {
  createRequestClientFor,
  getRequestClerkToken,
  SupabaseRequestError,
} from '@/src/services/supabase';

import { getBackendAuthMode, getRequestUserId, RequestAuthError } from './auth';
import { jsonError } from './responses';

export class RequestDataError extends Error {
  readonly code = 'data_unavailable' as const;
  readonly status = 503 as const;

  constructor(message: string) {
    super(message);
    this.name = 'RequestDataError';
  }
}

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
  assertServerRuntimeEnvironmentConfigured();

  const userId = await getRequestUserId(request);
  const supabase = createRequestClientFor(request);

  if (getBackendAuthMode() === 'clerk' && !supabase) {
    throw new RequestDataError(
      'The application data service is not configured for this environment.',
    );
  }

  return {
    supabase,
    token: getRequestClerkToken(request),
    userId,
  };
}

export async function withRequestContext(
  request: Request,
  handler: (context: RequestContext) => Promise<Response>,
): Promise<Response> {
  try {
    return await handler(await createRequestContext(request));
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return jsonError(error.status, error.code, error.message);
    }
    if (error instanceof RequestDataError) {
      return jsonError(error.status, error.code, error.message);
    }
    if (error instanceof ServerEnvironmentError) {
      console.error('[environment] server runtime misconfigured:', error.message);
      return jsonError(500, 'server_environment_invalid', error.message);
    }
    if (error instanceof MediaValidationError) {
      return jsonError(error.status, error.code, error.message);
    }
    if (error instanceof SupabaseRequestError) {
      console.error('[supabase] request failed:', error.message);
      return jsonError(
        503,
        'data_request_failed',
        'The application data service is temporarily unavailable.',
      );
    }
    throw error;
  }
}

// Context for the in-memory backend (unit tests).
export const memoryContext = (userId: string): RequestContext => ({
  supabase: null,
  token: null,
  userId,
});
