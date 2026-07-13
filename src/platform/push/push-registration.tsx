import { useRegisterPush } from './use-register-push';

// Mount inside the session context to register the device for push after
// sign-in. Renders nothing.
export function PushRegistration(): null {
  useRegisterPush();
  return null;
}
