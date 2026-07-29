import { useState } from 'react';
import { ScrollView } from 'react-native';

import * as Haptics from 'expo-haptics';

import { SearchSheet } from '@/src/components/shared/search-sheet';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { PinExplainerModal } from './pin-explainer-modal';
import { PostCard } from './post-card';
import { PostComposer, type PostComposerDraft } from './post-composer';
import { SubforumChips } from './subforum-chips';
import { usePinAction } from './use-pin-action';
import {
  useCreatePost,
  useForumPosts,
  useSubforums,
  useToggleLike,
} from './use-forum';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';
const FALLBACK_SUBFORUMS: readonly string[] = ['All'];

interface ForumScreenProps {
  readonly onOpenPost?: (postId: string) => void;
}

export function ForumScreen({ onOpenPost }: ForumScreenProps = {}) {
  const [activeForum, setActiveForum] = useState('All');
  const [isComposing, setIsComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const subforums = useSubforums();
  const posts = useForumPosts(activeForum);
  const toggleLike = useToggleLike();
  const createPost = useCreatePost();
  const pinAction = usePinAction();

  const subforumNames = subforums.data?.subforums ?? FALLBACK_SUBFORUMS;
  const composerForum =
    activeForum === 'All'
      ? (subforumNames.find((name) => name !== 'All') ?? 'Announcements')
      : activeForum;

  const handleCreatePost = (draft: PostComposerDraft) => {
    createPost.mutate(
      {
        excerpt: draft.excerpt,
        forum: draft.forum ?? composerForum,
        newMedia: draft.newMedia,
        title: draft.title,
      },
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
    <>
      <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <VStack space="md">
        <ScreenTitle
          eyebrow="Lake Las Vegas"
          onSearch={() => setIsSearching(true)}
          right={
            <Button
              className="rounded-full bg-accent px-4"
              onPress={() => setIsComposing(true)}
              testID="forum-add-post"
              size="sm"
            >
              <Icon color={COLOR_ACCENT_FOREGROUND} name="Edit" size={14} />
              <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
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
            <Icon color="rgb(169,156,139)" name="MessageCircle" size={28} />
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
                onOpen={() => onOpenPost?.(post.id)}
                onToggleLike={() =>
                  toggleLike.mutate({ forum: activeForum, postId: post.id })
                }
                pinAction={pinAction}
                post={post}
              />
            ))}
          </VStack>
        )}
      </VStack>
    </ScrollView>

      <Sheet onClose={() => setIsComposing(false)} visible={isComposing}>
        <PostComposer
          forum={composerForum}
          isSubmitting={createPost.isPending}
          onDismiss={() => setIsComposing(false)}
          onSubmit={handleCreatePost}
          subforums={subforumNames.filter((name) => name !== 'All')}
        />
        {createPost.isError ? (
          <Text className="px-5 pb-2 text-destructive" size="xs">
            Couldn&apos;t publish your post. Please try again.
          </Text>
        ) : null}
      </Sheet>

      <SearchSheet
        getKey={(post) => post.id}
        getSubtitle={(post) => post.forum}
        getTitle={(post) => post.title}
        items={posts.data?.posts ?? []}
        onClose={() => setIsSearching(false)}
        onSelect={(post) => onOpenPost?.(post.id)}
        placeholder="Search posts"
        visible={isSearching}
      />

      <PinExplainerModal
        onCancel={pinAction.cancelPending}
        onConfirm={pinAction.confirmPending}
        visible={pinAction.explainerVisible}
      />
    </>
  );
}
