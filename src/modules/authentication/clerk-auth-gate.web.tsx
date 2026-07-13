import type { PropsWithChildren } from 'react';

// AuthView is native-only; on web the app renders without the native gate.
export function ClerkAuthGate({ children }: PropsWithChildren) {
  return children;
}
