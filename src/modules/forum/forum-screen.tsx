import { useState } from 'react';
import { ScrollView } from 'react-native';

import * as Haptics from 'expo-haptics';

import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { PostCard } from './post-card';
import { PostComposer } from './post-composer';
import { SubforumChips } from './subforum-chips';
import {
  useCreatePost,
  useForumPosts,
  useSubforums,
  useToggleLike,
} from './use-forum';

const COLOR_PRIMARY_FOREGROUND = 'rgb(250,250,250)';
const FALLBACK_SUBFORUMS: readonly string[] = ['All'];

interface PostDraft {
  readonly title: string;
  readonly excerpt: string;
}

export function ForumScreen() {
  const [activeForum, setActiveForum] = useState('All');
  const [isComposing, setIsComposing] = useState(false);
  const subforums = useSubforums();
  const posts = useForumPosts(activeForum);
  const toggleLike = useToggleLike();
  const createPost = useCreatePost();

  const subforumNames = subforums.data?.subforums ?? FALLBACK_SUBFORUMS;
  const composerForum =
    activeForum === 'All'
      ? (subforumNames.find((name) => name !== 'All') ?? 'Announcements')
      : activeForum;

  const handleCreatePost = (draft: PostDraft) => {
    createPost.mutate(
      { excerpt: draft.excerpt, forum: composerForum, title: draft.title },
      {
        onSuccess: () => {
          setIsComposing(false);
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <VStack space="md">
        <ScreenTitle
          eyebrow="Lake Las Vegas"
          right={
            <Button
              className="rounded-full bg-primary px-4"
              onPress={() => setIsComposing((open) => !open)}
              size="sm"
            >
              <Icon color={COLOR_PRIMARY_FOREGROUND} name="Edit" size={14} />
              <ButtonText className="font-inter-semibold text-[13px] text-primary-foreground">
                Post
              </ButtonText>
            </Button>
          }
          title="Forum"
        />
        <SubforumChips
          active={activeForum}
          onSelect={setActiveForum}
          subforums={subforumNames}
        />
        {isComposing ? (
          <VStack space="xs">
            <PostComposer
              forum={composerForum}
              isSubmitting={createPost.isPending}
              onDismiss={() => setIsComposing(false)}
              onSubmit={handleCreatePost}
            />
            {createPost.isError ? (
              <Text className="mx-5 text-destructive" size="xs">
                Couldn&apos;t publish your post. Please try again.
              </Text>
            ) : null}
          </VStack>
        ) : null}
        {posts.isPending ? (
          <VStack className="items-center py-16">
            <Spinner size="large" />
          </VStack>
        ) : posts.isError ? (
          <VStack className="items-center py-16" space="sm">
            <Text className="text-text-muted" size="sm">
              Couldn&apos;t load posts.
            </Text>
            <Button
              action="secondary"
              className="rounded-full"
              onPress={() => void posts.refetch()}
              size="sm"
              variant="outline"
            >
              <ButtonText className="font-inter-semibold text-[13px]">
                Retry
              </ButtonText>
            </Button>
          </VStack>
        ) : posts.data.posts.length === 0 ? (
          <VStack className="items-center px-10 py-16" space="xs">
            <Icon color="rgb(161,161,170)" name="MessageCircle" size={28} />
            <Text className="text-center font-inter-semibold text-content" size="sm">
              No posts here yet
            </Text>
            <Text className="text-center text-text-muted" size="xs">
              Be the first to start a conversation in {activeForum}.
            </Text>
          </VStack>
        ) : (
          <VStack className="px-5" space="sm">
            {posts.data.posts.map((post) => (
              <PostCard
                key={post.id}
                onToggleLike={() =>
                  toggleLike.mutate({ forum: activeForum, postId: post.id })
                }
                post={post}
              />
            ))}
          </VStack>
        )}
      </VStack>
    </ScrollView>
  );
}
