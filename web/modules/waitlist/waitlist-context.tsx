'use client';

import * as React from 'react';

interface WaitlistState {
  readonly status: 'idle' | 'done';
  readonly message: React.ReactNode;
}

interface WaitlistContextValue extends WaitlistState {
  readonly markDone: (message: React.ReactNode) => void;
}

const WaitlistContext = React.createContext<WaitlistContextValue | null>(null);

// Shared across every WaitlistForm on the page -- there are two (hero and
// footer), and submitting either one should flip both to the success state
// rather than leaving the other looking like nothing happened.
export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WaitlistState>({ status: 'idle', message: null });

  const markDone = React.useCallback((message: React.ReactNode) => {
    setState({ status: 'done', message });
  }, []);

  const value = React.useMemo(() => ({ ...state, markDone }), [state, markDone]);

  return <WaitlistContext.Provider value={value}>{children}</WaitlistContext.Provider>;
}

export function useWaitlistStatus(): WaitlistContextValue {
  const context = React.useContext(WaitlistContext);
  if (!context) {
    throw new Error('useWaitlistStatus must be used within a WaitlistProvider');
  }
  return context;
}
