import { useCallback, useRef, useState } from 'react';

import * as Haptics from 'expo-haptics';
import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta } from './chrome';
import { COMPLETE_PHONE_LENGTH, formatPhoneNumber } from './phone-format';
import { usePhoneAuthentication } from './use-phone-authentication';

const OTP_LENGTH = 6;

function OtpBoxes({ code }: { readonly code: string }) {
  return (
    <View className="flex-row justify-center gap-2">
      {Array.from({ length: OTP_LENGTH }).map((_, index) => {
        const borderClassName =
          index === code.length ? 'border-2 border-indigo' : 'border border-line';
        const fillClassName = code[index] ? 'bg-secondary' : 'bg-canvas';
        return (
          <View
            className={`h-[56px] w-[46px] items-center justify-center rounded-[14px] ${borderClassName} ${fillClassName}`}
            key={index}
          >
            <Text className="font-inter-bold text-[22px] text-content">{code[index] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ClerkBadge() {
  return (
    <View className="flex-row items-center justify-center gap-1.5 pt-2.5">
      <Icon color="rgb(161,161,170)" name="Lock" size={12} />
      <Text className="text-[11px] text-text-subtle">
        Secured by{' '}
        <Text className="font-inter-semibold text-[11px] text-text-muted">Clerk</Text>
      </Text>
    </View>
  );
}

interface AuthStepProps {
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export function AuthStep({ onNext, onBack }: AuthStepProps) {
  const auth = usePhoneAuthentication();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const otpInputRef = useRef<TextInput>(null);

  const phoneComplete = phone.length >= COMPLETE_PHONE_LENGTH;

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(formatPhoneNumber(value));
  }, []);

  const handleSendCode = useCallback(() => {
    void auth.requestCode(phone);
  }, [auth, phone]);

  const handleBack = useCallback(() => {
    if (auth.phase === 'otp') {
      setCode('');
      auth.backToPhone();
      return;
    }
    onBack();
  }, [auth, onBack]);

  const handleCodeChange = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
      setCode(digits);
      if (digits.length !== OTP_LENGTH) {
        return;
      }
      void auth.verifyCode(digits).then((verified) => {
        if (verified) {
          void Haptics.selectionAsync();
          onNext();
        }
      });
    },
    [auth, onNext],
  );

  const heading =
    auth.phase === 'phone'
      ? { sub: 'We text you a code — no passwords, ever.', title: "What's your number?" }
      : { sub: `Sent to +1 ${phone || '(702) 555-0134'}`, title: 'Enter the code' };

  return (
    <View className="flex-1 bg-canvas">
      <View className="px-3.5 pt-[18px]">
        <Pressable
          accessibilityRole="button"
          className="h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary"
          onPress={handleBack}
        >
          <Icon name="ArrowLeft" size={16} />
        </Pressable>
      </View>
      <View className="flex-1 justify-center gap-6 px-6">
        <View>
          <Text className="font-inter-bold text-[34px] leading-[38px] tracking-[-0.03em] text-content">
            {heading.title}
          </Text>
          <Text className="mt-2 text-muted-foreground" size="md">
            {heading.sub}
          </Text>
        </View>
        {auth.phase === 'phone' ? (
          <View className="h-[60px] flex-row items-center gap-2.5 rounded-[18px] border border-line bg-canvas px-[18px]">
            <Text className="shrink-0 font-inter-semibold text-[18px] text-content">+1</Text>
            <TextInput
              autoFocus
              className="min-w-0 flex-1 font-inter-semibold text-[18px] text-content"
              keyboardType="phone-pad"
              onChangeText={handlePhoneChange}
              placeholder="(702) 555-0134"
              placeholderTextColor="rgb(161,161,170)"
              value={phone}
            />
            {phoneComplete ? <Icon color="rgb(34,197,94)" name="CheckCircle" size={18} /> : null}
          </View>
        ) : (
          <Pressable className="gap-4" onPress={() => otpInputRef.current?.focus()}>
            <OtpBoxes code={code} />
            <TextInput
              autoFocus
              caretHidden
              className="absolute h-px w-px opacity-0"
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              onChangeText={handleCodeChange}
              ref={otpInputRef}
              value={code}
            />
            <Text className="text-center text-muted-foreground" size="xs">
              {"Didn't get it? "}
              <Text className="font-inter-bold text-indigo" size="xs">
                Resend code
              </Text>
            </Text>
          </Pressable>
        )}
      </View>
      <View className="pb-[34px]">
        {auth.phase === 'phone' ? (
          <ObCta disabled={!phoneComplete} label="Send code" onPress={handleSendCode} />
        ) : null}
        <ClerkBadge />
      </View>
    </View>
  );
}
