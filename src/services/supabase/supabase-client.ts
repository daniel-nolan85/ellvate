import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export const getSupabaseConfig = (): SupabaseConfig | null =>
  url && publishableKey ? { publishableKey, url } : null;

export const isSupabaseConfigured = (): boolean => getSupabaseConfig() !== null;

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

export const getRequestClerkToken = (request: Request): string | null =>
  request.headers.get('authorization')?.match(BEARER_PATTERN)?.[1]?.trim() ??
  null;

// A Supabase client scoped to a single request. When a Clerk session token is
// present it is forwarded via `accessToken`, so Supabase validates it (Clerk
// third-party auth) and Row-Level Security applies per user. Without a token the
// client acts anonymously and only public-read policies apply.
export const createRequestClient = (
  clerkToken: string | null,
): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }
  return createClient(config.url, config.publishableKey, {
    accessToken: async () => clerkToken,
  });
};

export const createRequestClientFor = (
  request: Request,
): SupabaseClient | null => createRequestClient(getRequestClerkToken(request));
