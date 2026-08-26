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

interface AccountIdentifiersSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onUpdated: (message: string) => void;
}

// The profile screen's "Email" row opens this. Kept as a sheet (rather than
// jumping straight to IdentifierUpdateForm) so the same shell can grow back
// a phone row later without restructuring -- see use-identifier-update.ts,
// which is already generic over IdentifierKind for exactly that reason.
export function AccountIdentifiersSheet({
  onClose,
  onUpdated,
  visible,
}: AccountIdentifiersSheetProps) {
  const { user } = useUser();
  const [editing, setEditing] = useState<IdentifierKind | null>(null);

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
    onUpdated('Email updated');
    setEditing(null);
  };

  return (
    <Sheet onClose={close} visible={visible}>
      {editing ? (
        <IdentifierUpdateForm
          hasExisting={Boolean(emailValue)}
          kind={editing}
          onBack={() => setEditing(null)}
          onUpdated={handleUpdated}
        />
      ) : (
        <VStack className="px-5 pb-2 pt-1" space="md">
          <Heading className="font-inter-bold" size="lg">
            Email address
          </Heading>
          <Text className="text-text-muted" size="sm">
            Changing your email replaces it — the old one stops working right
            away.
          </Text>
          <VStack className="overflow-hidden rounded-2xl border border-surface-hairline">
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
