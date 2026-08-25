import { useCallback, useState } from 'react';

import { useUser } from '@clerk/expo';

import { messageForAuthError } from '@/src/modules/authentication';

export type IdentifierKind = 'email' | 'phone';
export type IdentifierUpdateStep = 'value' | 'code';

type UserResource = NonNullable<ReturnType<typeof useUser>['user']>;
type PendingResource =
  | Awaited<ReturnType<UserResource['createEmailAddress']>>
  | Awaited<ReturnType<UserResource['createPhoneNumber']>>;

// One email and one phone per account, by design -- see submitCode. A user
// who loses access to an old number/address should never leave it able to
// sign in, so this always verifies the new identifier before removing
// whatever it replaces, never the other way around.
export function useIdentifierUpdate(kind: IdentifierKind) {
  const { user } = useUser();
  const [step, setStep] = useState<IdentifierUpdateStep>('value');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingResource | null>(null);

  const submitValue = useCallback(
    async (value: string) => {
      if (!user || busy) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const created =
          kind === 'email'
            ? await user.createEmailAddress({ email: value })
            : await user.createPhoneNumber({ phoneNumber: value });
        // created's static type is the union of both resource kinds, so TS
        // can't correlate it with the already-narrowed `kind` here -- same
        // situation as resend below, and the same cast fixes it.
        const prepareVerification = created.prepareVerification as (
          params: { strategy: 'email_code' | 'phone_code' },
        ) => Promise<unknown>;
        await prepareVerification(
          kind === 'email' ? { strategy: 'email_code' } : { strategy: 'phone_code' },
        );
        setPending(created);
        setStep('code');
      } catch (caught) {
        setError(
          messageForAuthError(
            caught,
            kind === 'email'
              ? 'We could not start email verification. Try again.'
              : 'We could not start phone verification. Try again.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, kind, user],
  );

  const submitCode = useCallback(
    async (code: string): Promise<boolean> => {
      if (!user || !pending || busy) {
        return false;
      }
      setBusy(true);
      setError(null);
      try {
        await pending.attemptVerification({ code });
        // Verified -- make it the one used going forward, then remove
        // whatever it replaced. Filters rather than a single lookup so this
        // still cleans up correctly even if more than one somehow existed.
        const replaced =
          kind === 'email'
            ? user.emailAddresses.filter((email) => email.id !== pending.id)
            : user.phoneNumbers.filter((phone) => phone.id !== pending.id);
        await user.update(
          kind === 'email'
            ? { primaryEmailAddressId: pending.id }
            : { primaryPhoneNumberId: pending.id },
        );
        await Promise.all(replaced.map((resource) => resource.destroy()));
        setPending(null);
        setStep('value');
        return true;
      } catch {
        setError('That code did not match. Check it and try again.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy, kind, pending, user],
  );

  const resend = useCallback(async () => {
    if (!pending || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // pending's static type is a union of both resource kinds (it's set
      // from whichever branch submitValue took), so TS can't correlate it
      // with the already-narrowed `kind` here the way it could inline in
      // submitValue -- the two are always in sync at runtime by construction
      // (this hook is always called with one fixed kind for its lifetime).
      const prepareVerification = pending.prepareVerification as (
        params: { strategy: 'email_code' | 'phone_code' },
      ) => Promise<unknown>;
      await prepareVerification(
        kind === 'email' ? { strategy: 'email_code' } : { strategy: 'phone_code' },
      );
    } catch (caught) {
      setError(messageForAuthError(caught, 'We could not resend the code.'));
    } finally {
      setBusy(false);
    }
  }, [busy, kind, pending]);

  const reset = useCallback(() => {
    setStep('value');
    setError(null);
    setPending(null);
  }, []);

  return { busy, error, reset, resend, step, submitCode, submitValue };
}
