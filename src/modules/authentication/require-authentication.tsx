import type { PropsWithChildren, ReactNode } from 'react';

import { useSession, type SessionStatus } from '@/src/platform/session';

import { AuthenticationStateScreen } from './authentication-state-screen';

export type AuthenticationGateDecision =
  | 'allow'
  | 'wait'
  | 'require-authentication'
  | 'require-setup';

export const getAuthenticationGateDecision = (
  status: SessionStatus,
): AuthenticationGateDecision => {
  switch (status) {
    case 'signed-in':
      return 'allow';
    case 'loading':
      return 'wait';
    case 'signed-out':
      return 'require-authentication';
    case 'disabled':
    case 'misconfigured':
      return 'require-setup';
  }
};

interface RequireAuthenticationProps extends PropsWithChildren {
  readonly fallback?: ReactNode;
  readonly loadingFallback?: ReactNode;
}

export function RequireAuthentication({
  children,
  fallback,
  loadingFallback,
}: RequireAuthenticationProps) {
  const session = useSession();
  const decision = getAuthenticationGateDecision(session.status);

  if (decision === 'allow') {
    return children;
  }

  if (decision === 'wait' && loadingFallback !== undefined) {
    return loadingFallback;
  }

  return fallback ?? <AuthenticationStateScreen />;
}
