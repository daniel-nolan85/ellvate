import { Pressable, Text as RNText } from 'react-native';

import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { formatRelativeTime } from './relative-time';
import type { ForumComment } from './use-comments';

const MENTION_PATTERN = /(@[A-Za-z][A-Za-z'-]*)/g;

function CommentBody({ body }: { readonly body: string }) {
  const segments = body.split(MENTION_PATTERN);
  return (
    <RNText className="text-[14px] leading-5 text-content">
      {segments.map((segment, index) => (
        <RNText
          className={
            segment.startsWith('@') ? 'font-inter-medium text-indigo' : undefined
          }
          key={`${index}-${segment}`}
        >
          {segment}
        </RNText>
      ))}
    </RNText>
  );
}

interface CommentItemProps {
  readonly comment: ForumComment;
  readonly onReply: (name: string) => void;
  readonly onActions: (comment: ForumComment) => void;
}

export function CommentItem({ comment, onReply, onActions }: CommentItemProps) {
  return (
    <HStack className="gap-2.5" testID={`comment-item-${comment.id}`}>
      <Avatar name={comment.author.name} size="sm" />
      <VStack className="flex-1 gap-1">
        <HStack className="items-baseline gap-1.5">
          <Text className="font-inter-medium text-[14px] text-content">
            {comment.author.name}
          </Text>
          <Text className="text-[12px] text-text-muted">
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </HStack>
        <CommentBody body={comment.body} />
        <HStack className="mt-0.5 items-center gap-4">
          <Pressable onPress={() => onReply(comment.author.name)}>
            <Text className="font-inter-medium text-[12px] text-text-muted">
              Reply
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Comment actions"
            onPress={() => onActions(comment)}
            testID={`comment-actions-${comment.id}`}
          >
            <Icon color="rgb(113,113,123)" name="ThreeDots" size={16} />
          </Pressable>
        </HStack>
      </VStack>
    </HStack>
  );
}
