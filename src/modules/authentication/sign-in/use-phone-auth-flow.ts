import { useCallback, useState } from 'react';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

// A combined sign-in-or-up flow for the app's enabled factors: phone number +
// password, verified by an SMS code. Existing numbers sign in with a code; new
// numbers set a password, then verify. Built on Clerk's "future" custom-flow
// resource API (methods return { error } rather than throwing).
export type AuthStep = 'phone' | 'password' | 'code';
export type AuthMode = 'signIn' | 'signUp';

const messageFor = (error: unknown, fallback: string): string => {
  const candidate = error as
    | { readonly message?: string; readonly errors?: readonly { message?: string }[] }
    | null
    | undefined;
  return candidate?.message ?? candidate?.errors?.[0]?.message ?? fallback;
};

export function usePhoneAuthFlow() {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [step, setStep] = useState<AuthStep>('phone');
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPhone = useCallback(
    async (e164Phone: string) => {
      if (!isLoaded || busy) {
        return;
      }
      setBusy(true);
      setError(null);
      setPhone(e164Phone);
      try {
        const { error: createError } = await signIn.create({
          identifier: e164Phone,
        });
        if (createError) {
          // No account for this number yet — create one.
          setMode('signUp');
          setStep('password');
          return;
        }
        const { error: sendError } = await signIn.phoneCode.sendCode();
        if (sendError) {
          setError(messageFor(sendError, 'We couldn’t send a code. Try again.'));
          return;
        }
        setMode('signIn');
        setStep('code');
      } catch (caught) {
        setError(messageFor(caught, 'That number didn’t work. Try again.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, signIn],
  );

  const submitPassword = useCallback(
    async (password: string) => {
      if (!isLoaded || busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const { error: createError } = await signUp.create({
          password,
          phoneNumber: phone,
        });
        if (createError) {
          setError(messageFor(createError, 'That password didn’t work. Try again.'));
          return;
        }
        const { error: sendError } = await signUp.verifications.sendPhoneCode();
        if (sendError) {
          setError(messageFor(sendError, 'We couldn’t send a code. Try again.'));
          return;
        }
        setStep('code');
      } catch (caught) {
        setError(messageFor(caught, 'Something went wrong. Try again.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, phone, signUp],
  );

  // Returns true once the session is active (caller can offer a passkey next).
  const submitCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!isLoaded || busy) {
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        if (mode === 'signIn') {
          const { error: verifyError } = await signIn.phoneCode.verifyCode({
            code,
          });
          if (verifyError) {
            setError(messageFor(verifyError, 'That code didn’t match. Try again.'));
            return false;
          }
          if (signIn.status === 'complete') {
            await signIn.finalize();
            return true;
          }
        } else {
          const { error: verifyError } =
            await signUp.verifications.verifyPhoneCode({ code });
          if (verifyError) {
            setError(messageFor(verifyError, 'That code didn’t match. Try again.'));
            return false;
          }
          if (signUp.status === 'complete') {
            await signUp.finalize();
            return true;
          }
        }
        setError('That code didn’t match. Check it and try again.');
        return false;
      } catch (caught) {
        setError(messageFor(caught, 'That code didn’t match. Try again.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, mode, signIn, signUp],
  );

  const back = useCallback(() => {
    setError(null);
    setStep('phone');
  }, []);

  return {
    back,
    busy,
    error,
    mode,
    phone,
    ready: isLoaded,
    step,
    submitCode,
    submitPassword,
    submitPhone,
  };
}
