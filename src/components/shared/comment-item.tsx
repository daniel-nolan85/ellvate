import { Pressable, Text as RNText } from 'react-native';

import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

const MENTION_PATTERN = /(@[A-Za-z][A-Za-z'-]*)/g;

function CommentBody({ body }: { readonly body: string }) {
  const segments = body.split(MENTION_PATTERN);
  return (
    <RNText className="text-[14px] leading-5 text-content">
      {segments.map((segment, index) => (
        <RNText
          className={
            segment.startsWith('@') ? 'font-inter-medium text-accent' : undefined
          }
          key={`${index}-${segment}`}
        >
          {segment}
        </RNText>
      ))}
    </RNText>
  );
}

export interface DisplayComment {
  readonly id: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatarUrl?: string | null;
  };
  readonly body: string;
  readonly createdAt: string;
}

interface CommentItemProps<TComment extends DisplayComment> {
  readonly comment: TComment;
  readonly onReply: (name: string) => void;
  readonly onActions: (comment: TComment) => void;
  readonly onOpenAuthor: (authorId: string) => void;
}

export function CommentItem<TComment extends DisplayComment>({
  comment,
  onActions,
  onOpenAuthor,
  onReply,
}: CommentItemProps<TComment>) {
  return (
    <HStack className="gap-2.5" testID={`comment-item-${comment.id}`}>
      <Pressable
        accessibilityLabel={`Open ${comment.author.name}'s profile`}
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => onOpenAuthor(comment.author.id)}
      >
        <Avatar name={comment.author.name} size="sm" src={comment.author.avatarUrl ?? undefined} />
      </Pressable>
      <VStack className="flex-1 gap-1">
        <HStack className="items-baseline gap-1.5">
          <Pressable onPress={() => onOpenAuthor(comment.author.id)}>
            <Text className="font-inter-medium text-[14px] text-content">
              {comment.author.name}
            </Text>
          </Pressable>
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
            <Icon color="rgb(120,108,94)" name="ThreeDots" size={16} />
          </Pressable>
        </HStack>
      </VStack>
    </HStack>
  );
}
