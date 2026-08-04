import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import * as Haptics from 'expo-haptics';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { SearchSheet } from '@/src/components/shared/search-sheet';
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
} from './use-forum';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';
const FALLBACK_SUBFORUMS: readonly string[] = ['All'];
const FOR_YOU = 'For You';

interface ForumScreenProps {
  readonly onOpenPost?: (postId: string) => void;
}

export function ForumScreen({ onOpenPost }: ForumScreenProps = {}) {
  const [activeForum, setActiveForum] = useState('All');
  const [isComposing, setIsComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
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

  const subforumNames = subforums.data?.subforums ?? FALLBACK_SUBFORUMS;
  const chipNames = showForYou ? [FOR_YOU, ...subforumNames] : subforumNames;
  const composerForum =
    activeForum === 'All' || activeForum === FOR_YOU
      ? (subforumNames.find((name) => name !== 'All') ?? 'Announcements')
      : activeForum;

  const displayedPosts = useMemo(() => {
    const all = posts.data?.posts ?? [];
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
          subforums={chipNames}
        />
        {posts.isPending ? (
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
        ) : displayedPosts.length === 0 ? (
          <VStack className="items-center px-10 py-16" space="xs">
            <Icon color="rgb(169,156,139)" name="MessageCircle" size={28} />
            <Text className="text-center font-inter-semibold text-content" size="sm">
              No posts here yet
            </Text>
            <Text className="text-center text-text-muted" size="xs">
              {activeForum === FOR_YOU
                ? 'No posts match your interests yet.'
                : `Be the first to start a conversation in ${activeForum}.`}
            </Text>
          </VStack>
        ) : (
          <VStack className="px-5" space="sm">
            {displayedPosts.map((post) => (
              <PostCard
                key={post.id}
                onOpen={() => onOpenPost?.(post.id)}
                onToggleLike={() =>
                  toggleLike.mutate({ forum: post.forum, postId: post.id })
                }
                pinAction={pinAction}
                post={post}
              />
            ))}
            <AllCaughtUp />
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
        items={displayedPosts}
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
