import { useEffect } from 'react';

import { useWelcomeBackNotice } from './welcome-back-notice';

// Module-level, not React state and not persisted -- survives every remount
// of the caller within the same app process (e.g. a sign-out/sign-in cycle
// without force-quitting), but naturally resets to false on the next real
// cold launch, when this module is freshly evaluated again. That's exactly
// "once per cold launch, not every sign-in": AsyncStorage would remember
// across launches too, which isn't what was asked for.
let shownThisLaunch = false;

// Fires the "Welcome back" greeting once per cold launch, right where
// app/index.tsx redirects an already-signed-in, already-onboarded user
// straight to the community routes -- the common "just reopened the app"
// case. Distinct from WelcomeBackNoticeProvider's other caller
// (onboarding-flow.tsx), which covers a different, rarer case: a signed-in
// user who briefly lands back in the onboarding wizard despite already
// being done (e.g. a reinstall where Clerk's session survived but the local
// onboarding flag didn't). The two never fire in the same launch --
// app/index.tsx either redirects straight to the forum or routes into
// onboarding, never both -- so there's no risk of a double greeting.
export function useWelcomeBackOnLaunch(
  name: string | undefined,
  active: boolean,
) {
  const { show } = useWelcomeBackNotice();

  useEffect(() => {
    if (!active || shownThisLaunch) {
      return;
    }
    shownThisLaunch = true;
    // An empty string renders a name-less "Welcome back!" instead of blank
    // -- same fallback onboarding-flow.tsx's own call site already relies on.
    show((name ?? '').trim());
  }, [active, name, show]);
}
