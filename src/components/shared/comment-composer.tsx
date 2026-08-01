import { Pressable, View } from 'react-native';

import { GrowingTextInput } from '@/src/components/ui/growing-text-input';
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
          <Icon color="rgb(120,108,94)" name="MessageCircle" size={16} />
          <Text className="flex-1 text-[13px] text-text-muted">
            Replying to{' '}
            <Text className="font-inter-semibold text-content">{replyTo}</Text>
          </Text>
          <Pressable accessibilityLabel="Cancel reply" onPress={onClearReply}>
            <Icon color="rgb(120,108,94)" name="Close" size={16} />
          </Pressable>
        </View>
      ) : null}
      <View className="flex-row items-end gap-2.5">
        <GrowingTextInput
          className="flex-1 rounded-[20px] border border-content px-4 py-2.5 text-[14px] text-content"
          maxHeight={120}
          onChangeText={onChangeText}
          onSubmitEditing={() => canSend && onSend()}
          placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
          submitOnEnter
          testID="comment-input"
          value={value}
        />
        <Pressable
          accessibilityLabel="Send comment"
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
          disabled={!canSend}
          onPress={onSend}
          style={{ opacity: canSend ? 1 : 0.5 }}
          testID="comment-send"
        >
          <Icon color="rgb(250,250,250)" name="ArrowUp" size={18} />
        </Pressable>
      </View>
    </View>
  );
}
