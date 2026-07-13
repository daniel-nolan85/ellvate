import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField, InputSlot } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { CodeInput } from './code-input';
import { usePhoneAuthFlow } from './use-phone-auth-flow';

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const toE164 = (formatted: string): string =>
  `+1${formatted.replace(/\D/g, '').slice(0, 10)}`;

const displayPhone = (e164: string): string =>
  `+1 ${formatPhone(e164.replace(/^\+1/, ''))}`;

interface SignInScreenProps {
  readonly onSignedUp: () => void;
}

export function SignInScreen({ onSignedUp }: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const flow = usePhoneAuthFlow();

  const [phoneText, setPhoneText] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);

  const phoneComplete = phoneText.replace(/\D/g, '').length === 10;

  const handleCode = async (entered: string) => {
    const outcome = await flow.submitCode(entered);
    if (outcome === 'error') {
      setCode('');
      setCodeInvalid(true);
    } else if (outcome === 'signed-in' && flow.mode === 'signUp') {
      onSignedUp();
    }
    // 'need-password' advances the step; the password screen renders next.
  };

  const onPrimary = async () => {
    if (flow.step === 'phone' && phoneComplete) {
      await flow.submitPhone(toE164(phoneText));
    } else if (flow.step === 'password' && password.length >= 8) {
      const done = await flow.submitPassword(password);
      if (done) {
        onSignedUp();
      }
    }
  };

  const heading =
    flow.step === 'phone'
      ? {
          sub: 'We’ll text you a 6-digit code. No passwords to remember.',
          title: 'What’s your phone number?',
        }
      : flow.step === 'code'
        ? {
            sub: `We sent a code to ${displayPhone(flow.phone)}.`,
            title: 'Enter the code',
          }
        : {
            sub: 'Pick something only you know — at least 8 characters.',
            title: 'Create a password',
          };

  return (
    <View
      className="flex-1 bg-canvas px-6"
      style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 16 }}
    >
      <View className="h-9 justify-center">
        {flow.step !== 'phone' ? (
          <Pressable
            accessibilityLabel="Back"
            className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
            onPress={() => {
              setCode('');
              setCodeInvalid(false);
              flow.restart();
            }}
          >
            <Icon name="ChevronLeft" size={20} />
          </Pressable>
        ) : null}
      </View>

      <VStack className="mt-8 flex-1" space="xl">
        <VStack space="sm">
          <Heading className="font-inter-bold tracking-[-0.6px]" size="2xl">
            {heading.title}
          </Heading>
          <Text className="leading-6 text-muted-foreground" size="md">
            {heading.sub}
          </Text>
        </VStack>

        {flow.step === 'phone' ? (
          <Input size="lg">
            <InputSlot>
              <Text className="font-inter-semibold text-[17px] text-content">
                +1
              </Text>
            </InputSlot>
            <InputField
              autoFocus
              className="text-[17px]"
              keyboardType="phone-pad"
              onChangeText={(value) => setPhoneText(formatPhone(value))}
              onSubmitEditing={onPrimary}
              placeholder="(702) 555-0134"
              value={phoneText}
            />
          </Input>
        ) : flow.step === 'code' ? (
          <VStack space="md">
            <CodeInput
              invalid={codeInvalid}
              onChangeText={(value) => {
                setCode(value);
                setCodeInvalid(false);
              }}
              onComplete={handleCode}
              value={code}
            />
            <Pressable onPress={() => flow.submitPhone(flow.phone)}>
              <Text className="text-center text-muted-foreground" size="sm">
                Didn’t get it?{' '}
                <Text className="font-inter-semibold text-indigo">Resend code</Text>
              </Text>
            </Pressable>
          </VStack>
        ) : (
          <Input size="lg">
            <InputField
              autoFocus
              className="text-[17px]"
              onChangeText={setPassword}
              onSubmitEditing={onPrimary}
              placeholder="At least 8 characters"
              secureTextEntry
              value={password}
            />
          </Input>
        )}

        {flow.error ? (
          <Text className="text-destructive" size="sm">
            {flow.error}
          </Text>
        ) : null}
      </VStack>

      {flow.step !== 'code' ? (
        <Button
          className="h-[54px] rounded-2xl bg-primary"
          isDisabled={
            flow.busy ||
            !flow.ready ||
            (flow.step === 'phone' ? !phoneComplete : password.length < 8)
          }
          onPress={onPrimary}
          size="lg"
        >
          <ButtonText className="font-inter-semibold text-[16px] text-primary-foreground">
            {flow.busy ? 'Just a moment…' : 'Continue'}
          </ButtonText>
        </Button>
      ) : null}
    </View>
  );
}
