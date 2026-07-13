import { useEffect, useState } from 'react';

import { isOnboardingComplete } from './use-onboarding-state';

export function useOnboardingComplete(): boolean | undefined {
  const [complete, setComplete] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void isOnboardingComplete().then((value) => {
      if (active) {
        setComplete(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return complete;
}
