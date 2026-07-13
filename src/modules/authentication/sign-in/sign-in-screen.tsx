import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Input } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

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

interface SignInScreenProps {
  readonly onSignedUp: () => void;
}

export function SignInScreen({ onSignedUp }: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const flow = usePhoneAuthFlow();

  const [phoneText, setPhoneText] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const phoneComplete = phoneText.replace(/\D/g, '').length === 10;

  const onContinue = async () => {
    if (flow.step === 'phone' && phoneComplete) {
      await flow.submitPhone(toE164(phoneText));
    } else if (flow.step === 'password' && password.length >= 8) {
      await flow.submitPassword(password);
    } else if (flow.step === 'code' && code.length === 6) {
      const signedIn = await flow.submitCode(code);
      if (signedIn && flow.mode === 'signUp') {
        onSignedUp();
      }
    }
  };

  const heading =
    flow.step === 'phone'
      ? { sub: 'We’ll send you a text with a code to sign in.', title: 'What’s your phone number?' }
      : flow.step === 'password'
        ? { sub: 'Pick something only you know — at least 8 characters.', title: 'Create a password' }
        : { sub: `We sent a 6-digit code to ${flow.phone}.`, title: 'Enter the code' };

  const canContinue =
    flow.step === 'phone'
      ? phoneComplete
      : flow.step === 'password'
        ? password.length >= 8
        : code.length === 6;

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
            onPress={flow.back}
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
          <Input
            autoFocus
            keyboardType="phone-pad"
            leftIcon={
              <Text className="font-inter-semibold text-content" size="lg">
                +1
              </Text>
            }
            onChangeText={(value) => setPhoneText(formatPhone(value))}
            onSubmitEditing={onContinue}
            placeholder="(702) 555-0134"
            size="lg"
            value={phoneText}
          />
        ) : flow.step === 'password' ? (
          <Input
            autoFocus
            onChangeText={setPassword}
            onSubmitEditing={onContinue}
            placeholder="Your password"
            secureTextEntry
            size="lg"
            value={password}
          />
        ) : (
          <Input
            autoFocus
            keyboardType="number-pad"
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            onSubmitEditing={onContinue}
            placeholder="123456"
            size="lg"
            value={code}
          />
        )}

        {flow.error ? (
          <Text className="text-destructive" size="sm">
            {flow.error}
          </Text>
        ) : null}
      </VStack>

      <Button
        className="h-[52px] rounded-full bg-primary"
        isDisabled={!canContinue || flow.busy || !flow.ready}
        onPress={onContinue}
        size="lg"
      >
        <ButtonText className="font-inter-semibold text-[15px] text-primary-foreground">
          {flow.busy ? 'Just a moment…' : 'Continue'}
        </ButtonText>
      </Button>
    </View>
  );
}
