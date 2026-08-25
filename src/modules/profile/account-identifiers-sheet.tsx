import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useUser } from '@clerk/expo';

import { Heading } from '@/src/components/ui/heading';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { IdentifierUpdateForm } from './identifier-update-form';
import { type IdentifierKind } from './use-identifier-update';

// This app's own phone numbers are always +1 followed by 10 digits (see
// toE164 in identifier-update-form.tsx), so stripping a leading country-code
// "1" before grouping is safe here specifically, unlike a general E.164
// formatter would need to be.
const formatDisplayPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) {
    return value;
  }
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};

interface AccountIdentifiersSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onUpdated: (message: string) => void;
}

// The profile screen's "Phone & email" row opens this. Rather than jumping
// straight into an edit form, it lists both current values first (mirroring
// Clerk's own native account modal) so changing one doesn't require already
// knowing which of the two you're about to lose access to.
export function AccountIdentifiersSheet({
  onClose,
  onUpdated,
  visible,
}: AccountIdentifiersSheetProps) {
  const { user } = useUser();
  const [editing, setEditing] = useState<IdentifierKind | null>(null);

  const phoneValue = user?.primaryPhoneNumber?.phoneNumber ?? null;
  const emailValue = user?.primaryEmailAddress?.emailAddress ?? null;

  const close = () => {
    setEditing(null);
    onClose();
  };

  const handleUpdated = () => {
    if (!editing) {
      return;
    }
    void user?.reload();
    onUpdated(editing === 'phone' ? 'Phone number updated' : 'Email updated');
    setEditing(null);
  };

  return (
    <Sheet onClose={close} visible={visible}>
      {editing ? (
        <IdentifierUpdateForm
          hasExisting={Boolean(editing === 'phone' ? phoneValue : emailValue)}
          kind={editing}
          onBack={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      ) : (
        <VStack className="px-5 pb-2 pt-1" space="md">
          <Heading className="font-inter-bold" size="lg">
            Phone & email
          </Heading>
          <Text className="text-text-muted" size="sm">
            You can sign in with either one. Changing either replaces it — the
            old one stops working right away.
          </Text>
          <VStack className="overflow-hidden rounded-2xl border border-surface-hairline">
            <Pressable
              className="flex-row items-center gap-3 border-b border-surface-hairline px-4 py-3.5"
              onPress={() => setEditing('phone')}
              testID="account-identifier-phone-row"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Icon color="rgb(181,80,44)" name="Phone" size={16} />
              </View>
              <View className="flex-1">
                <Text className="font-inter-medium text-content" size="sm">
                  Phone number
                </Text>
                <Text className="text-text-muted" size="xs">
                  {phoneValue ? formatDisplayPhone(phoneValue) : 'Not set'}
                </Text>
              </View>
              <Text className="font-inter-semibold text-accent" size="sm">
                {phoneValue ? 'Change' : 'Add'}
              </Text>
            </Pressable>
            <Pressable
              className="flex-row items-center gap-3 px-4 py-3.5"
              onPress={() => setEditing('email')}
              testID="account-identifier-email-row"
            >
              <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
                <Icon color="rgb(181,80,44)" name="Mail" size={16} />
              </View>
              <View className="flex-1">
                <Text className="font-inter-medium text-content" size="sm">
                  Email address
                </Text>
                <Text className="text-text-muted" size="xs">
                  {emailValue ?? 'Not set'}
                </Text>
              </View>
              <Text className="font-inter-semibold text-accent" size="sm">
                {emailValue ? 'Change' : 'Add'}
              </Text>
            </Pressable>
          </VStack>
        </VStack>
      )}
    </Sheet>
  );
}
