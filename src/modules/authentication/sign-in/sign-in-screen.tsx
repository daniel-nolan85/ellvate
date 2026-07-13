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

const MIN_PASSWORD = 8;

interface SignInScreenProps {
  // Fires once the session is active, whether the number signed in or signed up.
  readonly onAuthenticated: () => void;
  // Pressing back on the first (phone) screen leaves auth, e.g. to the welcome step.
  readonly onExit?: () => void;
}

export function SignInScreen({ onAuthenticated, onExit }: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const flow = usePhoneAuthFlow();

  const [phoneText, setPhoneText] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);

  const phoneComplete = phoneText.replace(/\D/g, '').length === 10;
  const passwordReady = password.length >= MIN_PASSWORD;

  const goBack = () => {
    setCode('');
    setCodeInvalid(false);
    setPassword('');
    setShowPassword(false);
    flow.restart();
  };

  const handleBack = () => {
    if (flow.step === 'phone') {
      onExit?.();
      return;
    }
    goBack();
  };

  const handleCode = async (entered: string) => {
    const signedIn = await flow.submitCode(entered);
    if (!signedIn) {
      setCode('');
      setCodeInvalid(true);
      return;
    }
    onAuthenticated();
  };

  const onPrimary = async () => {
    if (flow.step === 'phone' && phoneComplete) {
      await flow.submitPhone(toE164(phoneText));
    } else if (flow.step === 'password' && passwordReady) {
      await flow.submitPassword(password);
    }
  };

  const heading =
    flow.step === 'phone'
      ? {
          sub: 'We’ll text you a quick 6-digit code to make sure it’s really you.',
          title: 'What’s your number?',
        }
      : flow.step === 'password'
        ? {
            sub: 'At least 8 characters — something only you would guess. Tap the eye to check it.',
            title: 'Now pick a password',
          }
        : {
            sub: `We just texted a 6-digit code to ${displayPhone(flow.phone)}. Pop it in below.`,
            title: 'Check your messages',
          };

  return (
    <View
      className="flex-1 bg-canvas px-6"
      style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 16 }}
    >
      <View className="h-9 justify-center">
        {flow.step !== 'phone' || onExit ? (
          <Pressable
            accessibilityLabel="Back"
            className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
            onPress={handleBack}
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
              autoComplete="tel"
              autoFocus
              className="text-[17px]"
              keyboardType="phone-pad"
              onChangeText={(value) => setPhoneText(formatPhone(value))}
              onSubmitEditing={onPrimary}
              placeholder="(702) 555-0134"
              textContentType="telephoneNumber"
              value={phoneText}
            />
          </Input>
        ) : flow.step === 'password' ? (
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              autoComplete="new-password"
              autoFocus
              className="text-[17px]"
              onChangeText={setPassword}
              onSubmitEditing={onPrimary}
              placeholder="Create a password"
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={password}
            />
            <InputSlot
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              className="h-full justify-center pl-1"
              onPress={() => setShowPassword((visible) => !visible)}
            >
              <Icon
                color="rgb(161,161,170)"
                name={showPassword ? 'Eye' : 'EyeOff'}
                size={20}
              />
            </InputSlot>
          </Input>
        ) : (
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
            <Pressable onPress={() => void flow.resend()}>
              <Text className="text-center text-muted-foreground" size="sm">
                Didn’t come through?{' '}
                <Text className="font-inter-semibold text-indigo">Send a new one</Text>
              </Text>
            </Pressable>
          </VStack>
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
            (flow.step === 'phone' ? !phoneComplete : !passwordReady)
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
