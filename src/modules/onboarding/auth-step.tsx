import { SignInScreen } from '@/src/modules/authentication';

interface AuthStepProps {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

// Real Clerk sign-in / sign-up: phone + password + code. Onboarding navigation
// skips this slot once a session is active, so it only ever renders for a
// signed-out visitor; pressing back on the phone screen returns to welcome.
export function AuthStep({ onBack, onNext }: AuthStepProps) {
  return <SignInScreen onAuthenticated={onNext} onExit={onBack} />;
}
