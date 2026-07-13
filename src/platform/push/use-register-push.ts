import { useEffect, useRef } from 'react';

import { useSession } from '@/src/platform/session';

import { registerForPushNotifications } from './register-for-push';

// Registers the device for push once, right after the user is signed in.
export function useRegisterPush(): void {
  const session = useSession();
  const registered = useRef(false);

  useEffect(() => {
    if (session.status !== 'signed-in' || registered.current) {
      return;
    }
    registered.current = true;
    void registerForPushNotifications(session.getToken);
  }, [session]);
}
