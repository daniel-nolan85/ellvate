import { useEffect, useRef } from 'react';

import { useSession } from '@/src/platform/session';

import {
  registerForPushNotifications,
  subscribeToPushTokenChanges,
} from './register-for-push';

// Registers the device for push once, right after the user is signed in.
export function useRegisterPush(): void {
  const session = useSession();
  const registeredUserId = useRef<string | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (session.status !== 'signed-in') {
      registeredUserId.current = null;
      unsubscribe.current?.();
      unsubscribe.current = null;
      return;
    }

    if (registeredUserId.current === session.userId) {
      return;
    }

    unsubscribe.current?.();
    unsubscribe.current = null;
    let cancelled = false;
    const run = async () => {
      for (let attempt = 0; attempt < 3 && !cancelled; attempt += 1) {
        const result = await registerForPushNotifications(session.getToken);
        if (result.status !== 'failed') {
          registeredUserId.current = session.userId;
          unsubscribe.current = await subscribeToPushTokenChanges(session.getToken);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
      }
    };

    void run();
    return () => {
      cancelled = true;
      unsubscribe.current?.();
      unsubscribe.current = null;
    };
  }, [session]);
}
