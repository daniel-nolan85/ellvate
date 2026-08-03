import { Modal, Pressable } from 'react-native';

import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';

const COLOR_DESTRUCTIVE = 'rgb(231,0,11)';

interface ConfirmModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message: string;
  readonly onClose: () => void;
  // Omit onConfirm for a single-button informational dialog (cancelLabel
  // becomes its only button, defaulting to "OK").
  readonly onConfirm?: () => void;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
}

// react-native-web's Alert.alert() is a no-op with no UI — see
// node_modules/react-native-web/src/exports/Alert. Any confirmation that
// must work on web needs a real modal like this one instead.
export function ConfirmModal({
  cancelLabel,
  confirmLabel = 'Confirm',
  destructive,
  message,
  onClose,
  onConfirm,
  title,
  visible,
}: ConfirmModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8"
        onPress={onClose}
      >
        <Pressable
          className="w-full gap-1 rounded-[20px] bg-paper p-5"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="font-inter-bold text-[17px] text-content">
            {title}
          </Text>
          <Text className="pb-3 text-text-muted" size="sm">
            {message}
          </Text>
          <HStack className="justify-end gap-3">
            {onConfirm ? (
              <>
                <Pressable onPress={onClose}>
                  <Text className="font-inter-semibold text-[15px] text-content">
                    {cancelLabel ?? 'Cancel'}
                  </Text>
                </Pressable>
                <Pressable onPress={onConfirm}>
                  <Text
                    className="font-inter-semibold text-[15px]"
                    style={destructive ? { color: COLOR_DESTRUCTIVE } : undefined}
                  >
                    {confirmLabel}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={onClose}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  {cancelLabel ?? 'OK'}
                </Text>
              </Pressable>
            )}
          </HStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
