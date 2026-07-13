import { PasskeyOffer } from '@/src/modules/authentication';

interface PasskeyStepProps {
  readonly onNext: () => void;
}

// Offered near the end of onboarding. The flow only includes this step when
// Clerk is usable, and it is reached only after the user has signed in, so a
// live Clerk user is always present.
export function PasskeyStep({ onNext }: PasskeyStepProps) {
  return <PasskeyOffer continueLabel="Continue" onDone={onNext} />;
}
