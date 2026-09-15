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
  readonly editing?: boolean;
  readonly onCancelEdit?: () => void;
}

export function CommentComposer({
  value,
  onChangeText,
  onSend,
  replyTo,
  onClearReply,
  isSending,
  editing = false,
  onCancelEdit,
}: CommentComposerProps) {
  const canSend = value.trim().length > 0 && !isSending;
  return (
    // collapsable={false}: this View is a fixed-height sibling docked below
    // a flex-1 FlatList in every screen that renders it -- exactly the shape
    // RN's view-flattening optimization can collapse into its parent,
    // letting the composer paint at the wrong position (overlapping list
    // content instead of sitting below it) instead of just being invisible.
    // Same root cause and fix as the header on the digest screen.
    //
    // bg-paper + shadow-hard-4 (an upward-cast shadow): without its own
    // opaque background this View was the same color as the canvas behind
    // it, so scrolled-to-the-edge content read as running straight into the
    // composer with no visible seam. A first attempt paired bg-paper with
    // the standard border-line hairline (12% opacity) -- too subtle a color
    // shift within this app's deliberately low-contrast palette to register
    // reliably, especially over a compressed screenshot, and native
    // shadow-* box-shadow translation isn't guaranteed to carry all the way
    // through on-device the way it does on web. A visibly thicker,
    // higher-opacity border is the one part of this that's guaranteed to
    // render identically on every platform, so it carries the fix even if
    // the shadow doesn't land.
    <View
      className="gap-2.5 border-t-2 border-[rgba(37,30,23,0.35)] bg-paper px-[18px] pb-9 pt-2.5 shadow-hard-4"
      collapsable={false}
    >
      {editing ? (
        <View className="flex-row items-center gap-2 rounded-lg bg-accent-subtle px-3 py-2">
          <Icon color="rgb(181,80,44)" name="Edit" size={16} />
          <Text className="flex-1 text-[13px] text-text-muted">
            Editing your comment
          </Text>
          <Pressable accessibilityLabel="Cancel edit" onPress={onCancelEdit}>
            <Icon color="rgb(120,108,94)" name="Close" size={16} />
          </Pressable>
        </View>
      ) : replyTo ? (
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
          maxLength={500}
          onChangeText={onChangeText}
          onSubmitEditing={() => canSend && onSend()}
          placeholder={editing ? 'Edit your comment…' : replyTo ? 'Write a reply…' : 'Add a comment…'}
          submitOnEnter
          testID="comment-input"
          value={value}
        />
        <Pressable
          accessibilityLabel={editing ? 'Save comment' : 'Send comment'}
          className="h-10 w-10 items-center justify-center rounded-full bg-accent"
          disabled={!canSend}
          onPress={onSend}
          style={{ opacity: canSend ? 1 : 0.5 }}
          testID="comment-send"
        >
          <Icon color="rgb(250,250,250)" name={editing ? 'Check' : 'ArrowUp'} size={18} />
        </Pressable>
      </View>
    </View>
  );
}
