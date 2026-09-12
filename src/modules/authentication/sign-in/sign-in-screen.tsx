import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField, InputSlot } from '@/src/components/ui/input';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { publicEnvironment } from '@/src/platform/environment';

import { CodeInput } from './code-input';
import { useIdentifierAuthFlow } from './use-identifier-auth-flow';

const MARKETING_URL = publicEnvironment.marketingUrl;

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
  // Fires once the session is active, whether the identifier signed in or signed up.
  readonly onAuthenticated: () => void;
  // Pressing back on the first identifier screen leaves auth, e.g. to welcome.
  readonly onExit?: () => void;
}

export function SignInScreen({ onAuthenticated, onExit }: SignInScreenProps) {
  const insets = useSafeAreaInsets();
  const flow = useIdentifierAuthFlow();

  const [phoneText, setPhoneText] = useState('');
  const [emailText, setEmailText] = useState('');
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    if (flow.step !== 'consent') {
      setConsentChecked(false);
    }
  }, [flow.step]);

  const identifierText = flow.kind === 'phone' ? phoneText : emailText;
  const identifierComplete =
    flow.kind === 'phone'
      ? phoneText.replace(/\D/g, '').length === 10
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText.trim());

  const goBack = () => {
    setCode('');
    setCodeInvalid(false);
    flow.restart();
  };

  const handleBack = () => {
    if (flow.step === 'identifier') {
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
    if (flow.step === 'identifier' && identifierComplete) {
      await flow.submitIdentifier(
        flow.kind === 'phone' ? toE164(phoneText) : emailText.trim(),
      );
    }
  };

  // The consent sheet slides up over this same identifier screen rather than
  // replacing it, so it shares this screen's heading and form -- only the
  // code step (a genuinely different screen) needs its own.
  const heading =
    flow.step !== 'code'
      ? flow.kind === 'phone'
        ? {
            sub: 'We’ll text you a quick 6-digit code to confirm your number.',
            title: 'What’s your number?',
          }
        : {
            sub: 'We’ll email you a quick 6-digit code to confirm your email.',
            title: 'What’s your email?',
          }
      : {
          sub: `We just sent a 6-digit code to ${identifierText}. Pop it in below.`,
          title: 'Check your messages',
        };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-canvas px-6"
      style={{ paddingBottom: insets.bottom + 24, paddingTop: insets.top + 16 }}
    >
      <View className="h-9 justify-center">
        {flow.step !== 'identifier' || onExit ? (
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

        {flow.step !== 'code' ? (
          <VStack space="md">
            <Input size="lg">
              {flow.kind === 'phone' ? (
                <InputSlot>
                  <Text className="font-inter-semibold text-[17px] text-content">+1</Text>
                </InputSlot>
              ) : null}
              <InputField
                autoCapitalize="none"
                autoComplete={flow.kind === 'phone' ? 'tel' : 'email'}
                autoFocus
                className="text-[17px]"
                key={flow.kind}
                keyboardType={flow.kind === 'phone' ? 'phone-pad' : 'email-address'}
                onChangeText={(value) =>
                  flow.kind === 'phone'
                    ? setPhoneText(formatPhone(value))
                    : setEmailText(value)
                }
                onSubmitEditing={onPrimary}
                placeholder={flow.kind === 'phone' ? '(702) 555-0134' : 'you@example.com'}
                testID="auth-identifier-input"
                textContentType={flow.kind === 'phone' ? 'telephoneNumber' : 'emailAddress'}
                value={identifierText}
              />
            </Input>
          </VStack>
        ) : (
          <VStack space="md">
            <CodeInput
              invalid={codeInvalid}
              onChangeText={(value) => {
                setCode(value);
                setCodeInvalid(false);
              }}
              onComplete={handleCode}
              testID="auth-code-input"
              value={code}
            />
            <Pressable onPress={() => void flow.resend()}>
              <Text className="text-center text-muted-foreground" size="sm">
                Didn’t come through?{' '}
                <Text className="font-inter-semibold text-accent">Send a new one</Text>
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

      {flow.step === 'identifier' ? (
        <Button
          className="h-[54px] rounded-2xl bg-accent"
          isDisabled={
            flow.busy ||
            !flow.ready ||
            !identifierComplete
          }
          onPress={onPrimary}
          size="lg"
        >
          <ButtonText className="font-inter-semibold text-[16px] text-accent-foreground">
            {flow.busy ? 'Just a moment…' : 'Continue'}
          </ButtonText>
        </Button>
      ) : null}

      <Sheet
        dismissable={false}
        onClose={() => {}}
        visible={flow.step === 'consent'}
      >
        <VStack className="px-5 pb-2 pt-1" space="md">
          <Heading className="font-inter-bold" size="lg">
            Before you join
          </Heading>
          <Text className="leading-6 text-muted-foreground" size="sm">
            Please agree to continue creating your account.
          </Text>
          <View className="flex-row items-start gap-3 rounded-2xl border border-surface-hairline bg-canvas px-4 py-3.5">
            {/* A separate Pressable from the text below -- nesting the Terms/
                Privacy links' own onPress inside a Pressable wrapping the
                whole row swallowed their taps entirely, so every tap just
                toggled the checkbox regardless of where in the row it landed. */}
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentChecked }}
              hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
              className={`mt-0.5 h-5 w-5 items-center justify-center rounded-md border ${
                consentChecked
                  ? 'border-accent bg-accent'
                  : 'border-surface-hairline bg-paper'
              }`}
              onPress={() => setConsentChecked((current) => !current)}
              testID="auth-consent-checkbox"
            >
              {consentChecked ? (
                <Icon color="rgb(255,255,255)" name="Check" size={13} />
              ) : null}
            </Pressable>
            <Text className="flex-1 leading-5 text-content" size="sm">
              I agree to the{' '}
              <Text
                className="font-inter-semibold text-accent"
                onPress={() =>
                  MARKETING_URL
                    ? void Linking.openURL(`${MARKETING_URL}/terms`)
                    : undefined
                }
                size="sm"
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                className="font-inter-semibold text-accent"
                onPress={() =>
                  MARKETING_URL
                    ? void Linking.openURL(`${MARKETING_URL}/privacy`)
                    : undefined
                }
                size="sm"
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
          <Button
            className="h-[52px] rounded-2xl bg-accent"
            isDisabled={!consentChecked || flow.busy}
            onPress={() => void flow.confirmConsent()}
            size="lg"
          >
            <ButtonText className="font-inter-semibold text-accent-foreground">
              {flow.busy ? 'Just a moment…' : 'Agree & continue'}
            </ButtonText>
          </Button>
          <Pressable onPress={flow.declineConsent}>
            <Text className="text-center text-muted-foreground" size="sm">
              Cancel
            </Text>
          </Pressable>
        </VStack>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
