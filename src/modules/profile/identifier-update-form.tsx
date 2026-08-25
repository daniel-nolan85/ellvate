import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { CodeInput } from '@/src/modules/authentication';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { useIdentifierUpdate, type IdentifierKind } from './use-identifier-update';

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

interface IdentifierUpdateFormProps {
  readonly kind: IdentifierKind;
  // Whether this account already has a phone/email of this kind -- purely
  // for copy ("Add" vs "Change"). The actual create/verify/swap logic in
  // useIdentifierUpdate behaves identically either way.
  readonly hasExisting: boolean;
  // Returns to the phone/email list within the same sheet, rather than
  // closing it -- this form is one view inside AccountIdentifiersSheet, not
  // a sheet of its own.
  readonly onBack: () => void;
  readonly onUpdated: () => void;
}

// Create -> verify -> swap-the-old-one-out, via Clerk's own user resource
// APIs (the same ones its native account modal calls internally) -- see
// useIdentifierUpdate for why the swap only happens after verification
// succeeds.
export function IdentifierUpdateForm({
  hasExisting,
  kind,
  onBack,
  onUpdated,
}: IdentifierUpdateFormProps) {
  const identifierUpdate = useIdentifierUpdate(kind);
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);

  useEffect(() => {
    return () => identifierUpdate.reset();
    // Reset on unmount only (leaving this form, one way or another) --
    // identifierUpdate.reset is a fresh closure each render, not a signal
    // this should re-run mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valueComplete =
    kind === 'phone'
      ? value.replace(/\D/g, '').length === 10
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const submitValue = async () => {
    if (!valueComplete) {
      return;
    }
    await identifierUpdate.submitValue(
      kind === 'phone' ? toE164(value) : value.trim(),
    );
  };

  const handleCode = async (entered: string) => {
    const done = await identifierUpdate.submitCode(entered);
    if (!done) {
      setCode('');
      setCodeInvalid(true);
      return;
    }
    onUpdated();
  };

  const handleBack = () => {
    if (identifierUpdate.step === 'code') {
      identifierUpdate.reset();
      setValue('');
      setCode('');
      setCodeInvalid(false);
      return;
    }
    onBack();
  };

  return (
    <VStack className="px-5 pb-2 pt-1" space="md">
      <Pressable
        accessibilityLabel="Back"
        className="h-9 w-9 items-center justify-center rounded-full bg-secondary"
        onPress={handleBack}
      >
        <Icon name="ChevronLeft" size={20} />
      </Pressable>

      {identifierUpdate.step === 'value' ? (
        <VStack space="md">
          <Text className="font-inter-bold text-[17px] text-content">
            {hasExisting
              ? kind === 'phone'
                ? 'Change phone number'
                : 'Change email'
              : kind === 'phone'
                ? 'Add a phone number'
                : 'Add an email'}
          </Text>
          <Text className="text-text-muted" size="sm">
            {kind === 'phone'
              ? "We'll text a code to your new number to confirm it's you."
              : "We'll email a code to your new address to confirm it's you."}
          </Text>
          <Input size="lg">
            <InputField
              autoCapitalize="none"
              autoComplete={kind === 'phone' ? 'tel' : 'email'}
              autoFocus
              keyboardType={kind === 'phone' ? 'phone-pad' : 'email-address'}
              onChangeText={(text) =>
                setValue(kind === 'phone' ? formatPhone(text) : text)
              }
              onSubmitEditing={() => void submitValue()}
              placeholder={kind === 'phone' ? '(702) 555-0134' : 'you@example.com'}
              testID={`identifier-update-${kind}-input`}
              value={value}
            />
          </Input>
          {identifierUpdate.error ? (
            <Text className="text-destructive" size="sm">
              {identifierUpdate.error}
            </Text>
          ) : null}
          <Button
            className="h-[52px] rounded-2xl bg-accent"
            isDisabled={!valueComplete || identifierUpdate.busy}
            onPress={() => void submitValue()}
            size="lg"
          >
            <ButtonText className="font-inter-semibold text-accent-foreground">
              {identifierUpdate.busy ? 'Just a moment…' : 'Send code'}
            </ButtonText>
          </Button>
        </VStack>
      ) : (
        <VStack space="md">
          <Text className="font-inter-bold text-[17px] text-content">
            Enter the code
          </Text>
          <Text className="text-text-muted" size="sm">
            We just sent a 6-digit code to {value}. Pop it in below.
          </Text>
          <CodeInput
            invalid={codeInvalid}
            onChangeText={(text) => {
              setCode(text);
              setCodeInvalid(false);
            }}
            onComplete={handleCode}
            testID={`identifier-update-${kind}-code`}
            value={code}
          />
          {identifierUpdate.error ? (
            <Text className="text-destructive" size="sm">
              {identifierUpdate.error}
            </Text>
          ) : null}
          <Pressable onPress={() => void identifierUpdate.resend()}>
            <Text className="text-center text-muted-foreground" size="sm">
              Didn’t come through?{' '}
              <Text className="font-inter-semibold text-accent">Send a new one</Text>
            </Text>
          </Pressable>
        </VStack>
      )}
    </VStack>
  );
}
