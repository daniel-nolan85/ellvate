import { Pressable, View } from 'react-native';

import * as Haptics from 'expo-haptics';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { formatRelativeTime } from './relative-time';
import type { ForumPost } from './use-forum';

const COLOR_CONTENT = 'rgb(10,10,10)';
const COLOR_PRIMARY_FOREGROUND = 'rgb(250,250,250)';
const COLOR_TEXT_SUBTLE = 'rgb(161,161,170)';
const COLOR_INDIGO = 'rgb(99,102,241)';

interface PostCardProps {
  readonly post: ForumPost;
  readonly onToggleLike: () => void;
  readonly onOpen?: () => void;
}

export function PostCard({ onToggleLike, onOpen, post }: PostCardProps) {
  const handleLike = () => {
    void Haptics.selectionAsync();
    onToggleLike();
  };

  return (
    <View className="gap-4 rounded-[20px] border border-line bg-canvas p-[18px]">
      <Pressable
        accessibilityLabel={`Open post: ${post.title}`}
        accessibilityRole="button"
        className="gap-4"
        onPress={onOpen}
        testID={`forum-post-${post.id}`}
      >
        <HStack className="items-center" space="sm">
          <Avatar name={post.author.name} size="sm" />
          <VStack className="flex-1" space="xs">
            <Text className="font-inter-bold" size="sm">
              {post.author.name}
            </Text>
            <Text className="text-text-muted" size="xs">
              {post.forum} · {formatRelativeTime(post.createdAt)}
            </Text>
          </VStack>
          {post.pinned ? (
            <Badge
              leftIcon={<Icon color={COLOR_INDIGO} name="Star" size={12} />}
              variant="indigo"
            >
              Pinned
            </Badge>
          ) : (
            <Icon color={COLOR_TEXT_SUBTLE} name="ThreeDots" size={16} />
          )}
        </HStack>
        <VStack space="xs">
          <Heading className="font-inter-bold tracking-[-0.36px]" size="md">
            {post.title}
          </Heading>
          <Text className="leading-[21px] text-text-muted" size="sm">
            {post.excerpt}
          </Text>
        </VStack>
      </Pressable>
      <HStack className="items-center" space="sm">
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-full px-3 py-[7px] ${
            post.liked ? 'bg-primary' : 'bg-secondary'
          }`}
          onPress={handleLike}
        >
          <Icon
            color={post.liked ? COLOR_PRIMARY_FOREGROUND : COLOR_CONTENT}
            name="Favourite"
            size={14}
          />
          <Text
            className={`font-inter-semibold text-[12px] leading-[16px] ${
              post.liked ? 'text-primary-foreground' : 'text-content'
            }`}
          >
            {post.likes}
          </Text>
        </Pressable>
        <Pressable
          className="flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-[7px]"
          onPress={onOpen}
        >
          <Icon color={COLOR_CONTENT} name="MessageCircle" size={14} />
          <Text className="font-inter-semibold text-[12px] leading-[16px] text-content">
            {post.replies}
          </Text>
        </Pressable>
        <View className="flex-1" />
        <Icon color={COLOR_TEXT_SUBTLE} name="Share" size={16} />
      </HStack>
    </View>
  );
}
