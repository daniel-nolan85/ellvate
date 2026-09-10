import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';
import { useProfile } from '@/src/modules/profile';

import { subforumsForInterests } from './interest-subforum-map';
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
  type ForumPost,
} from './use-forum';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';
const FALLBACK_SUBFORUMS: readonly string[] = ['All'];
const FOR_YOU = 'For You';

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="forum-load-more">
      <Spinner size="small" />
    </View>
  );
}

interface ForumScreenProps {
  readonly onOpenPost?: (postId: string) => void;
}

export function ForumScreen({ onOpenPost }: ForumScreenProps = {}) {
  const [activeForum, setActiveForum] = useState('All');
  const [isComposing, setIsComposing] = useState(false);
  const subforums = useSubforums();
  const profile = useProfile();
  // "For You" is a client-side filter over the same fetch as "All" — no
  // backend query param, since it can match posts across several subforums
  // at once (one per mapped interest) rather than a single forum name.
  const posts = useForumPosts(activeForum === FOR_YOU ? 'All' : activeForum);
  const toggleLike = useToggleLike();
  const createPost = useCreatePost();
  const pinAction = usePinAction();

  const interestSubforums = useMemo(
    () => subforumsForInterests(profile.data?.profile.interests ?? []),
    [profile.data],
  );
  // Show the chip whenever the user has picked any interests, even if none
  // of them map to a subforum — the "no posts match" empty state already
  // covers that case honestly, rather than hiding the tab with no explanation.
  const showForYou = (profile.data?.profile.interests.length ?? 0) > 0;

  // 'All' is a synthetic, app-level filter, not a real forum -- the backend
  // returns actual forum names only (from a real `subforums` table in
  // production; the local demo store's seed data happens to also include a
  // literal 'All' row, which masked this during earlier testing). Always
  // prepend it here instead of relying on the backend to include it, so
  // there's always a way back to the unfiltered feed after picking a chip.
  const realSubforumNames = (subforums.data?.subforums ?? FALLBACK_SUBFORUMS).filter(
    (name) => name !== 'All',
  );
  const chipNames = showForYou
    ? ['All', FOR_YOU, ...realSubforumNames]
    : ['All', ...realSubforumNames];
  const composerForum =
    activeForum === 'All' || activeForum === FOR_YOU
      ? (realSubforumNames[0] ?? 'Announcements')
      : activeForum;

  const displayedPosts = useMemo((): readonly ForumPost[] => {
    const all = posts.data?.pages.flatMap((page) => page.posts) ?? [];
    return activeForum === FOR_YOU
      ? all.filter((post) => interestSubforums.has(post.forum))
      : all;
  }, [posts.data, activeForum, interestSubforums]);

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
          void Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
        },
      },
    );
  };

  return (
    <>
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: this screen pairs a filter-chip row
          (SubforumChips) with a growing list, the exact shape that caused
          My Activity's "All" filter pills to corrupt under enough
          simultaneous content. Only rows actually on/near screen mount as
          real native views here, no matter how many posts load. */}
      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={displayedPosts}
        keyExtractor={(post) => post.id}
        ListEmptyComponent={
          posts.isPending ? (
            <VStack className="items-center py-16">
              <Spinner size="xlarge" />
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
          ) : (
            <VStack className="items-center px-10 py-16" space="xs">
              <Icon color="rgb(169,156,139)" name="MessageCircle" size={28} />
              <Text
                className="text-center font-inter-semibold text-content"
                size="sm"
              >
                No posts here yet
              </Text>
              <Text className="text-center text-text-muted" size="xs">
                {activeForum === FOR_YOU
                  ? 'No posts match your interests yet.'
                  : `Be the first to start a conversation in ${activeForum}.`}
              </Text>
            </VStack>
          )
        }
        ListFooterComponent={
          displayedPosts.length === 0 ? null : posts.hasNextPage ? (
            <LoadMoreFooter isLoading={posts.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="pb-3" space="md">
            <ScreenTitle
              eyebrow="Lake Las Vegas"
              onSearch={() => router.push('/search')}
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
              subforums={chipNames}
            />
          </VStack>
        }
        onEndReached={() => {
          if (posts.hasNextPage && !posts.isFetchingNextPage) {
            void posts.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => void posts.refetch()}
        refreshing={posts.isRefetching}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <PostCard
              onOpen={() => onOpenPost?.(item.id)}
              onToggleLike={() =>
                toggleLike.mutate({ forum: item.forum, postId: item.id })
              }
              pinAction={pinAction}
              post={item}
            />
          </View>
        )}
      />

      <Sheet onClose={() => setIsComposing(false)} visible={isComposing}>
        {(maxContentHeight) => (
          <>
            <PostComposer
              forum={composerForum}
              isSubmitting={createPost.isPending}
              maxContentHeight={maxContentHeight}
              onDismiss={() => setIsComposing(false)}
              onSubmit={handleCreatePost}
              subforums={realSubforumNames}
            />
            {createPost.isError ? (
              <Text className="px-5 pb-2 text-destructive" size="xs">
                Couldn&apos;t publish your post. Please try again.
              </Text>
            ) : null}
          </>
        )}
      </Sheet>

      <PinExplainerModal
        onCancel={pinAction.cancelPending}
        onConfirm={pinAction.confirmPending}
        visible={pinAction.explainerVisible}
      />
    </>
  );
}
