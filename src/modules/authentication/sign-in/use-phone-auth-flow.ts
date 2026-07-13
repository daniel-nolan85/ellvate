import { useCallback, useState } from 'react';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

// Combined sign-in-or-up on Clerk's future custom-flow API, ordered
// phone -> SMS code -> (new accounts) password. Existing numbers finish at the
// code step; new numbers verify first, then set a password. Methods return
// { error } instead of throwing.
export type AuthStep = 'phone' | 'code' | 'password';
export type AuthMode = 'signIn' | 'signUp';
export type CodeOutcome = 'signed-in' | 'need-password' | 'error';

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
        // No account for this number — start a sign-up (password comes later).
        const { error: createError } = await signUp.create({
          phoneNumber: e164Phone,
        });
        if (createError) {
          setError(messageFor(createError, 'That number didn’t work. Try again.'));
          return;
        }
        const { error: sendError } = await signUp.verifications.sendPhoneCode();
        if (sendError) {
          setError(messageFor(sendError, 'We couldn’t send a code. Try again.'));
          return;
        }
        setMode('signUp');
        setStep('code');
      } catch (caught) {
        setError(messageFor(caught, 'That number didn’t work. Try again.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, signIn, signUp],
  );

  const submitCode = useCallback(
    async (code: string): Promise<CodeOutcome> => {
      if (!isLoaded || busy) {
        return 'error';
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
            return 'error';
          }
          const { error: finalizeError } = await signIn.finalize();
          if (finalizeError) {
            setError(messageFor(finalizeError, 'Couldn’t finish signing in.'));
            return 'error';
          }
          return 'signed-in';
        }
        const { error: verifyError } =
          await signUp.verifications.verifyPhoneCode({ code });
        if (verifyError) {
          setError('That code didn’t match. Check it and try again.');
          return 'error';
        }
        // Number is verified; this instance still needs a password.
        setStep('password');
        return 'need-password';
      } catch (caught) {
        setError(messageFor(caught, 'That code didn’t match. Try again.'));
        return 'error';
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, mode, signIn, signUp],
  );

  const submitPassword = useCallback(
    async (password: string): Promise<boolean> => {
      if (!isLoaded || busy) {
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        const { error: updateError } = await signUp.password({
          password,
          phoneNumber: phone,
        });
        if (updateError) {
          setError(messageFor(updateError, 'That password didn’t work. Try again.'));
          return false;
        }
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(messageFor(finalizeError, 'Couldn’t finish setting up your account.'));
          return false;
        }
        return true;
      } catch (caught) {
        setError(messageFor(caught, 'That password didn’t work. Try again.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, phone, signUp],
  );

  const restart = useCallback(() => {
    setError(null);
    setStep('phone');
  }, []);

  return {
    busy,
    error,
    mode,
    phone,
    ready: isLoaded,
    restart,
    step,
    submitCode,
    submitPassword,
    submitPhone,
  };
}
