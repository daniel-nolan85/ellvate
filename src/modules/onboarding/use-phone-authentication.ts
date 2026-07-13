import { useCallback, useState } from 'react';

export type PhoneAuthenticationPhase = 'phone' | 'otp';

export interface PhoneAuthentication {
  readonly phase: PhoneAuthenticationPhase;
  requestCode(phone: string): Promise<void>;
  verifyCode(code: string): Promise<boolean>;
  backToPhone(): void;
}

const VERIFY_DELAY_MS = 350;
const OTP_CODE_PATTERN = /^\d{6}$/;

// Demo seam: Clerk phone_code sign-in/sign-up activation replaces this
// implementation per docs/clerk-activation.md.
export function usePhoneAuthentication(): PhoneAuthentication {
  const [phase, setPhase] = useState<PhoneAuthenticationPhase>('phone');

  const requestCode = useCallback(async (_phone: string): Promise<void> => {
    setPhase('otp');
  }, []);

  const verifyCode = useCallback(async (code: string): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, VERIFY_DELAY_MS));
    return OTP_CODE_PATTERN.test(code);
  }, []);

  const backToPhone = useCallback(() => {
    setPhase('phone');
  }, []);

  return { backToPhone, phase, requestCode, verifyCode };
}
