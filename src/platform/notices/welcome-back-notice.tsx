import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

interface WelcomeBackNoticeValue {
  readonly name: string | null;
  readonly show: (name: string) => void;
  readonly dismiss: () => void;
}

const WelcomeBackNoticeContext = createContext<WelcomeBackNoticeValue | null>(null);

// Lets a returning user's "Welcome back" greeting survive the navigation
// away from /onboarding -- if this state lived inside OnboardingFlow itself,
// router.replace() to the destination route would unmount it (and the modal
// with it) the instant it fired, before the greeting ever had a chance to
// show over the destination screen instead of over the onboarding wizard.
export function WelcomeBackNoticeProvider({ children }: PropsWithChildren) {
  const [name, setName] = useState<string | null>(null);
  const show = useCallback((value: string) => setName(value), []);
  const dismiss = useCallback(() => setName(null), []);
  const value = useMemo(() => ({ dismiss, name, show }), [dismiss, name, show]);

  return (
    <WelcomeBackNoticeContext.Provider value={value}>
      {children}
    </WelcomeBackNoticeContext.Provider>
  );
}

export function useWelcomeBackNotice(): WelcomeBackNoticeValue {
  const context = useContext(WelcomeBackNoticeContext);
  if (!context) {
    throw new Error(
      'useWelcomeBackNotice must be used within WelcomeBackNoticeProvider',
    );
  }
  return context;
}
