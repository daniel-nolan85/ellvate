import { useCallback, useState } from 'react';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

import {
  isMissingIdentifierError,
  messageForAuthError,
} from './auth-errors';

export type IdentifierKind = 'email' | 'phone';
export type AuthStep = 'identifier' | 'consent' | 'code';
export type AuthMode = 'signIn' | 'signUp';

const sendSignInCode = async (
  kind: IdentifierKind,
  signIn: ReturnType<typeof useSignIn>['signIn'],
) =>
  kind === 'email'
    ? signIn.emailCode.sendCode()
    : signIn.phoneCode.sendCode();

const sendSignUpCode = async (
  kind: IdentifierKind,
  signUp: ReturnType<typeof useSignUp>['signUp'],
) =>
  kind === 'email'
    ? signUp.verifications.sendEmailCode()
    : signUp.verifications.sendPhoneCode();

export function useIdentifierAuthFlow() {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [kind, setKind] = useState<IdentifierKind>('phone');
  const [step, setStep] = useState<AuthStep>('identifier');
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitIdentifier = useCallback(
    async (value: string) => {
      if (!isLoaded || busy) {
        return;
      }

      setBusy(true);
      setError(null);
      setIdentifier(value);

      try {
        let signInResult: Awaited<ReturnType<typeof signIn.create>>;
        try {
          signInResult = await signIn.create({
            identifier: value,
          });
        } catch (caught) {
          // Clerk can reject a missing identifier as a thrown API error rather
          // than returning it on the result object. Only that specific error
          // may cross into sign-up; network, rate-limit, and config failures
          // remain sign-in errors.
          if (!isMissingIdentifierError(caught)) {
            throw caught;
          }
          // Legal consent (required before the account can be created --
          // see confirmConsent) has to be collected before signUp.create()
          // fires, not after, so this only sets up for sign-up rather than
          // starting it.
          setMode('signUp');
          setStep('consent');
          return;
        }

        if (!signInResult.error) {
          const codeResult = await sendSignInCode(kind, signIn);
          if (codeResult.error) {
            setError(
              messageForAuthError(codeResult.error, 'We could not send a code. Try again.'),
            );
            return;
          }
          setMode('signIn');
          setStep('code');
          return;
        }

        if (!isMissingIdentifierError(signInResult.error)) {
          setError(
            messageForAuthError(signInResult.error, 'That identifier did not work. Try again.'),
          );
          return;
        }

        setMode('signUp');
        setStep('consent');
      } catch (caught) {
        setError(messageForAuthError(caught, 'Something went wrong. Try again.'));
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, kind, signIn],
  );

  // Collects legal consent before an account exists rather than after --
  // signUp.create() is what actually starts account creation and sends the
  // code, and legalAccepted has to be on that call (or a later update()
  // before finalize()) for a Clerk instance with "require legal consent"
  // turned on to ever reach status: 'complete'.
  const confirmConsent = useCallback(async () => {
    if (!isLoaded || busy) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const signUpResult = await signUp.create({
        ...(kind === 'email' ? { emailAddress: identifier } : { phoneNumber: identifier }),
        legalAccepted: true,
      });
      if (signUpResult.error) {
        setError(
          messageForAuthError(signUpResult.error, 'We could not start account creation.'),
        );
        return;
      }

      const codeResult = await sendSignUpCode(kind, signUp);
      if (codeResult.error) {
        setError(
          messageForAuthError(codeResult.error, 'We could not send a code. Try again.'),
        );
        return;
      }
      setStep('code');
    } catch (caught) {
      setError(messageForAuthError(caught, 'Something went wrong. Try again.'));
    } finally {
      setBusy(false);
    }
  }, [busy, identifier, isLoaded, kind, signUp]);

  const declineConsent = useCallback(() => {
    setError(null);
    setStep('identifier');
  }, []);

  const submitCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!isLoaded || busy) {
        return false;
      }

      setBusy(true);
      setError(null);
      try {
        const verification =
          mode === 'signIn'
            ? kind === 'email'
              ? await signIn.emailCode.verifyCode({ code })
              : await signIn.phoneCode.verifyCode({ code })
            : kind === 'email'
              ? await signUp.verifications.verifyEmailCode({ code })
              : await signUp.verifications.verifyPhoneCode({ code });

        if (verification.error) {
          setError('That code did not match. Check it and try again.');
          return false;
        }

        if (mode === 'signUp' && signUp.status !== 'complete') {
          setError(
            signUp.missingFields.length > 0
              ? `Still needed to finish sign-up: ${signUp.missingFields.join(', ')}.`
              : 'Sign-up could not be completed. Check your Clerk sign-up requirements.',
          );
          return false;
        }

        const finalized =
          mode === 'signIn'
            ? await signIn.finalize()
            : await signUp.finalize();
        if (finalized.error) {
          setError(messageForAuthError(finalized.error, 'Could not finish signing in.'));
          return false;
        }
        return true;
      } catch (caught) {
        setError(messageForAuthError(caught, 'That code did not match. Try again.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, isLoaded, kind, mode, signIn, signUp],
  );

  const resend = useCallback(async () => {
    if (!isLoaded || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'signIn'
          ? await sendSignInCode(kind, signIn)
          : await sendSignUpCode(kind, signUp);
      if (result.error) {
        setError(messageForAuthError(result.error, 'We could not resend the code.'));
      }
    } catch (caught) {
      setError(messageForAuthError(caught, 'We could not resend the code.'));
    } finally {
      setBusy(false);
    }
  }, [busy, isLoaded, kind, mode, signIn, signUp]);

  const restart = useCallback(() => {
    setError(null);
    setStep('identifier');
    setIdentifier('');
  }, []);

  const chooseKind = useCallback((nextKind: IdentifierKind) => {
    setKind(nextKind);
    setError(null);
    setStep('identifier');
    setIdentifier('');
  }, []);

  return {
    busy,
    chooseKind,
    confirmConsent,
    declineConsent,
    error,
    identifier,
    kind,
    mode,
    ready: isLoaded,
    resend,
    restart,
    step,
    submitCode,
    submitIdentifier,
  };
}
