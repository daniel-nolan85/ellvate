import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

interface CommentComposerProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly onSend: () => void;
  readonly replyTo: string | null;
  readonly onClearReply: () => void;
  readonly isSending: boolean;
}

export function CommentComposer({
  value,
  onChangeText,
  onSend,
  replyTo,
  onClearReply,
  isSending,
}: CommentComposerProps) {
  const canSend = value.trim().length > 0 && !isSending;
  return (
    <View className="gap-2.5 border-t border-line px-[18px] pb-9 pt-2.5">
      {replyTo ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-secondary px-3 py-2">
          <Icon color="rgb(113,113,123)" name="MessageCircle" size={16} />
          <Text className="flex-1 text-[13px] text-text-muted">
            Replying to{' '}
            <Text className="font-inter-semibold text-content">{replyTo}</Text>
          </Text>
          <Pressable accessibilityLabel="Cancel reply" onPress={onClearReply}>
            <Icon color="rgb(113,113,123)" name="Close" size={16} />
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2.5">
        <TextInput
          className="h-10 flex-1 rounded-full border border-content px-4 text-[14px] text-content"
          multiline={false}
          onChangeText={onChangeText}
          onSubmitEditing={() => canSend && onSend()}
          placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
          placeholderTextColor="rgb(161,161,170)"
          returnKeyType="send"
          value={value}
        />
        <Pressable
          accessibilityLabel="Send comment"
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          disabled={!canSend}
          onPress={onSend}
          style={{ opacity: canSend ? 1 : 0.5 }}
        >
          <Icon color="rgb(250,250,250)" name="ArrowUp" size={18} />
        </Pressable>
      </View>
    </View>
  );
}
