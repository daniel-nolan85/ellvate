import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

const COLOR_ACCENT = 'rgb(181,80,44)';

interface PinExplainerModalProps {
  readonly visible: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: (dontShowAgain: boolean) => void;
}

// Shown the first time a user pins a post (see use-pin-explainer.ts) — pin
// is exclusive and private per user (round 5), which isn't obvious from the
// icon alone, so this explains it once rather than surprising someone when
// their earlier pin quietly disappears.
export function PinExplainerModal({
  onCancel,
  onConfirm,
  visible,
}: PinExplainerModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleCancel = () => {
    setDontShowAgain(false);
    onCancel();
  };

  const handleConfirm = () => {
    const value = dontShowAgain;
    setDontShowAgain(false);
    onConfirm(value);
  };

  return (
    <Modal
      animationType='fade'
      onRequestClose={handleCancel}
      transparent
      visible={visible}
    >
      <Pressable
        className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8'
        onPress={handleCancel}
      >
        <Pressable
          className='w-full gap-3 rounded-[20px] bg-paper p-5'
          onPress={(event) => event.stopPropagation()}
        >
          <Text className='font-inter-bold text-[17px] text-content'>
            Pin this post?
          </Text>
          <Text className='text-text-muted' size='sm'>
            Pinned posts move to the top of the feed. You can only have one
            pinned at a time — pinning another post replaces it.
          </Text>
          <Pressable
            accessibilityLabel='Don’t show this again'
            accessibilityRole='checkbox'
            accessibilityState={{ checked: dontShowAgain }}
            className='flex-row items-center gap-2.5 py-1'
            onPress={() => setDontShowAgain((current) => !current)}
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-[6px] border ${
                dontShowAgain
                  ? 'border-accent bg-accent'
                  : 'border-surface-hairline bg-transparent'
              }`}
            >
              {dontShowAgain ? (
                <Icon color='rgb(255,255,255)' name='Check' size={12} />
              ) : null}
            </View>
            <Text className='text-[14px] text-content'>
              Don’t show this again
            </Text>
          </Pressable>
          <HStack className='justify-end gap-3 pt-1'>
            <Pressable onPress={handleCancel}>
              <Text className='font-inter-semibold text-[15px] text-text-muted'>
                Cancel
              </Text>
            </Pressable>
            <Pressable onPress={handleConfirm}>
              <Text
                className='font-inter-semibold text-[15px]'
                style={{ color: COLOR_ACCENT }}
              >
                Pin post
              </Text>
            </Pressable>
          </HStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
