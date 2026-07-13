import { fetch } from 'expo/fetch';

import { publicEnvironment } from '@/src/platform/environment';

import { ApiConfigurationError, ApiError } from './api-error';

interface ApiErrorBody {
  readonly code?: string;
  readonly message?: string;
}

export interface ApiRequest {
  readonly body?: unknown;
  readonly getAccessToken?: () => Promise<string | null>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  readonly path: `/${string}`;
  readonly signal?: AbortSignal;
}

const parseBody = (text: string): unknown => {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const asApiErrorBody = (value: unknown): ApiErrorBody => (
  typeof value === 'object' && value !== null ? value as ApiErrorBody : {}
);

export async function requestJson<T>({
  body,
  getAccessToken,
  headers,
  method = 'GET',
  path,
  signal,
}: ApiRequest): Promise<T> {
  if (!publicEnvironment.apiUrl) {
    throw new ApiConfigurationError(
      'Set EXPO_PUBLIC_API_URL before making API requests.',
    );
  }

  const accessToken = await getAccessToken?.();
  const response = await fetch(`${publicEnvironment.apiUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    method,
    signal,
  });

  const payload = parseBody(await response.text());

  if (!response.ok) {
    const errorBody = asApiErrorBody(payload);
    throw new ApiError({
      code: errorBody.code,
      details: payload,
      message: errorBody.message ?? `Request failed with HTTP ${response.status}.`,
      status: response.status,
    });
  }

  return payload as T;
}
