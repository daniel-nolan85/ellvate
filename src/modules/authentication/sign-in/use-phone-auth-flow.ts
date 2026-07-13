import { useCallback, useState } from 'react';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

// Combined sign-in-or-up on Clerk's future custom-flow API. Existing numbers
// sign in straight from the code (phone -> code). New numbers set a password
// first, because Clerk creates the account with the password and then verifies
// the phone (phone -> password -> code). Methods return { error }, not throw.
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
        const { error: signInError } = await signIn.create({
          identifier: e164Phone,
        });
        if (!signInError) {
          const { error: sendError } = await signIn.phoneCode.sendCode();
          if (sendError) {
            setError(messageFor(sendError, 'We couldn’t send a code. Try again.'));
            return;
          }
          setMode('signIn');
          setStep('code');
          return;
        }
        // No account for this number — collect a password, then create + verify.
        setMode('signUp');
        setStep('password');
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

  // Returns true once the session is active.
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
            setError('That code didn’t match. Check it and try again.');
            return false;
          }
          const { error: finalizeError } = await signIn.finalize();
          if (finalizeError) {
            setError(messageFor(finalizeError, 'Couldn’t finish signing in.'));
            return false;
          }
          return true;
        }
        const { error: verifyError } =
          await signUp.verifications.verifyPhoneCode({ code });
        if (verifyError) {
          setError('That code didn’t match. Check it and try again.');
          return false;
        }
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(messageFor(finalizeError, 'Couldn’t finish setting up your account.'));
          return false;
        }
        return true;
      } catch (caught) {
        setError(messageFor(caught, 'That code didn’t match. Try again.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, mode, signIn, signUp],
  );

  const restart = useCallback(() => {
    setError(null);
    setStep('phone');
  }, []);

  const resend = useCallback(async () => {
    if (!isLoaded) {
      return;
    }
    if (mode === 'signIn') {
      await signIn.phoneCode.sendCode();
    } else {
      await signUp.verifications.sendPhoneCode();
    }
  }, [isLoaded, mode, signIn, signUp]);

  return {
    busy,
    error,
    mode,
    phone,
    ready: isLoaded,
    resend,
    restart,
    step,
    submitCode,
    submitPassword,
    submitPhone,
  };
}
