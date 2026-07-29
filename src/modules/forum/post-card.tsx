import { useState } from 'react';
import { Modal, Pressable, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { MediaGallery } from '@/src/components/shared/media-gallery';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { categoryAccent } from '@/src/lib/category-accent';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useSession } from '@/src/platform/session';

import { PinExplainerModal } from './pin-explainer-modal';
import { PostComposer } from './post-composer';
import type { PinAction } from './use-pin-action';
import {
  useDeletePost,
  useMuteUser,
  useReportPost,
  useSubforums,
  useTogglePin,
  useUpdatePost,
  type ForumPost,
} from './use-forum';
import { usePinExplainerDismissed } from './use-pin-explainer';

const COLOR_CONTENT = 'rgb(37,30,23)';
const COLOR_TEXT_SUBTLE = 'rgb(169,156,139)';
const COLOR_AMBER = 'rgb(217,123,41)';
const COLOR_DESTRUCTIVE = 'rgb(231,0,11)';

interface PostCardProps {
  readonly post: ForumPost;
  readonly onToggleLike: () => void;
  readonly onOpen?: () => void;
  // Screens that render many PostCards at once (the forum list) pass a
  // shared PinAction so only one <PinExplainerModal> is ever mounted — see
  // use-pin-action.ts for why. Screens showing a single card at a time
  // (bookmarks/activity/digest preview sheets) can omit it; PostCard falls
  // back to managing its own local modal, which is safe with only one
  // instance on screen.
  readonly pinAction?: PinAction;
}

function PostMenuRow({
  destructive,
  icon,
  label,
  onPress,
}: {
  readonly destructive?: boolean;
  readonly icon: AppIconName;
  readonly label: string;
  readonly onPress: () => void;
}) {
  const color = destructive ? COLOR_DESTRUCTIVE : COLOR_CONTENT;
  return (
    <Pressable
      accessibilityRole='button'
      className='flex-row items-center gap-3 px-1.5 py-3.5'
      onPress={onPress}
    >
      <Icon color={color} name={icon} size={20} />
      <Text
        className='text-[15px]'
        style={{ color, fontWeight: destructive ? '500' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PostCard({ onOpen, onToggleLike, pinAction, post }: PostCardProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const currentUserId = session.userId ?? 'demo-user';
  const isOwnPost = currentUserId === post.author.id;

  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const muteUser = useMuteUser();
  const reportPost = useReportPost();
  const togglePin = useTogglePin();
  const pinExplainer = usePinExplainerDismissed();
  const subforums = useSubforums();
  const subforumNames = (subforums.data?.subforums ?? []).filter(
    (name) => name !== 'All',
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pinExplainerOpen, setPinExplainerOpen] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleLike = () => {
    void Haptics.selectionAsync();
    onToggleLike();
  };

  const handleShare = () => {
    void Share.share({
      message: `${post.title}\n\n${post.excerpt}`,
    });
  };

  const openAuthorProfile = () => {
    if (isOwnPost) {
      router.push('/profile');
      return;
    }
    router.push({
      params: { name: post.author.name, userId: post.author.id },
      pathname: '/member/[userId]',
    });
  };

  const handleEdit = () => {
    setMenuOpen(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setConfirmDeleteOpen(true);
  };

  const handleTogglePin = () => {
    setMenuOpen(false);
    togglePin.mutate(post.id, {
      onSuccess: (result) =>
        showToast(result.pinned ? 'Post pinned' : 'Post unpinned'),
      onError: () => showToast('Couldn’t update pin status. Try again.'),
    });
  };

  // Unpinning is self-explanatory and skips the explainer — only pinning
  // (which replaces whatever the user already had pinned) needs it, and
  // only until they've dismissed it once. When a shared pinAction is
  // provided (the forum list), defer to it instead of managing a local
  // modal — see PostCardProps.pinAction.
  const requestTogglePin = () => {
    if (pinAction) {
      setMenuOpen(false);
      pinAction.requestTogglePin(post, {
        onError: () => showToast('Couldn’t update pin status. Try again.'),
        onSuccess: (pinned) =>
          showToast(pinned ? 'Post pinned' : 'Post unpinned'),
      });
      return;
    }
    if (!post.pinned && !pinExplainer.dismissed) {
      setPinExplainerOpen(true);
      return;
    }
    handleTogglePin();
  };

  const confirmPinFromExplainer = (dontShowAgain: boolean) => {
    setPinExplainerOpen(false);
    if (dontShowAgain) {
      void pinExplainer.dismissForever();
    }
    handleTogglePin();
  };

  const confirmDelete = () => {
    setConfirmDeleteOpen(false);
    deletePost.mutate(post.id, {
      onSuccess: () =>
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ),
      onError: () => showToast('Couldn’t delete this post. Try again.'),
    });
  };

  const handleMute = () => {
    setMenuOpen(false);
    muteUser.mutate(post.author.id, {
      onSuccess: () => showToast(`Muted ${post.author.name}`),
      onError: () => showToast('Couldn’t mute this neighbour. Try again.'),
    });
  };

  const handleReport = () => {
    setMenuOpen(false);
    reportPost.mutate(post.id, {
      onSuccess: () =>
        showToast('Thanks — our moderators will take a look.'),
      onError: () => showToast('Couldn’t submit your report. Try again.'),
    });
  };

  return (
    <View className='gap-4 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
      <Pressable
        accessibilityLabel={`Open post: ${post.title}`}
        accessibilityRole='button'
        className='gap-4'
        onPress={onOpen}
        testID={`forum-post-${post.id}`}
      >
        <HStack className='items-center' space='sm'>
          <Pressable
            accessibilityLabel={
              isOwnPost
                ? 'Open your profile'
                : `Open ${post.author.name}'s profile`
            }
            accessibilityRole='button'
            className='flex-1 flex-row items-center gap-2.5'
            hitSlop={4}
            onPress={(event) => {
              event.stopPropagation();
              openAuthorProfile();
            }}
          >
            <Avatar name={post.author.name} size='sm' src={post.author.avatarUrl ?? undefined} />
            <VStack className='flex-1' space='xs'>
              <Text className='font-inter-bold' size='sm'>
                {post.author.name}
              </Text>
              <HStack className='items-center' space='xs'>
                <Badge variant={categoryAccent(post.forum)}>{post.forum}</Badge>
                <Text className='text-text-muted' size='xs'>
                  · {formatRelativeTime(post.createdAt)}
                </Text>
              </HStack>
            </VStack>
          </Pressable>
          <HStack className='items-center' space='sm'>
            <Pressable
              accessibilityLabel={post.pinned ? 'Unpin post' : 'Pin post'}
              accessibilityRole='button'
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                requestTogglePin();
              }}
            >
              <Icon
                color={post.pinned ? COLOR_AMBER : COLOR_TEXT_SUBTLE}
                fill={post.pinned ? COLOR_AMBER : 'none'}
                name='Pin'
                size={16}
              />
            </Pressable>
            <Pressable
              accessibilityLabel='More options'
              accessibilityRole='button'
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation();
                setMenuOpen(true);
              }}
            >
              <Icon color={COLOR_TEXT_SUBTLE} name='ThreeDots' size={16} />
            </Pressable>
          </HStack>
        </HStack>

        {post.media && post.media.length > 0 && (
          <MediaGallery media={post.media} />
        )}

        <VStack space='xs'>
          <Heading className='font-inter-bold tracking-[-0.36px]' size='md'>
            {post.title}
          </Heading>
          <Text className='leading-[21px] text-text-muted' size='sm'>
            {post.excerpt}
          </Text>
        </VStack>
      </Pressable>
      <HStack className='items-center' space='sm'>
        <Pressable
          className={`flex-row items-center gap-1.5 rounded-full px-3 py-[7px] ${
            post.liked ? 'bg-amber-subtle' : 'bg-secondary'
          }`}
          onPress={handleLike}
        >
          <Icon
            color={post.liked ? COLOR_AMBER : COLOR_CONTENT}
            fill={post.liked ? COLOR_AMBER : 'none'}
            name='Favourite'
            size={14}
          />
          <Text
            className={`font-inter-semibold text-[12px] leading-[16px] ${
              post.liked ? 'text-amber' : 'text-content'
            }`}
          >
            {post.likes}
          </Text>
        </Pressable>
        <Pressable
          className='flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-[7px]'
          onPress={onOpen}
        >
          <Icon color={COLOR_CONTENT} name='MessageCircle' size={14} />
          <Text className='font-inter-semibold text-[12px] leading-[16px] text-content'>
            {post.replies}
          </Text>
        </Pressable>
        <View className='flex-1' />
        <BookmarkButton targetId={post.id} targetType='post' />
        <Pressable
          accessibilityLabel='Share post'
          accessibilityRole='button'
          onPress={handleShare}
        >
          <Icon color={COLOR_TEXT_SUBTLE} name='Share' size={16} />
        </Pressable>
      </HStack>

      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className='gap-1 px-[18px] pb-2'>
          {isOwnPost ? (
            <>
              <PostMenuRow icon='Edit' label='Edit post' onPress={handleEdit} />
              <Divider />
              <PostMenuRow
                destructive
                icon='AlertCircle'
                label='Delete post'
                onPress={handleDelete}
              />
            </>
          ) : (
            <>
              <PostMenuRow
                icon='EyeOff'
                label='Mute this neighbour'
                onPress={handleMute}
              />
              <Divider />
              <PostMenuRow
                destructive
                icon='AlertCircle'
                label='Report post'
                onPress={handleReport}
              />
            </>
          )}
        </View>
      </Sheet>

      <Modal
        animationType='fade'
        onRequestClose={() => setConfirmDeleteOpen(false)}
        transparent
        visible={confirmDeleteOpen}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8'
          onPress={() => setConfirmDeleteOpen(false)}
        >
          <Pressable
            className='w-full gap-1 rounded-[20px] bg-paper p-5'
            onPress={(event) => event.stopPropagation()}
          >
            <Text className='font-inter-bold text-[17px] text-content'>
              Delete post?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setConfirmDeleteOpen(false)}>
                <Text className='font-inter-semibold text-[15px] text-content'>
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDelete}>
                <Text
                  className='font-inter-semibold text-[15px]'
                  style={{ color: COLOR_DESTRUCTIVE }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>

      <Sheet onClose={() => setIsEditing(false)} visible={isEditing}>
        <PostComposer
          forum={post.forum}
          initialExcerpt={post.excerpt}
          initialMedia={post.media}
          initialTitle={post.title}
          isSubmitting={updatePost.isPending}
          onDismiss={() => setIsEditing(false)}
          onSubmit={(draft) =>
            updatePost.mutate(
              {
                excerpt: draft.excerpt,
                existingMedia: draft.existingMedia,
                forum: draft.forum,
                newMedia: draft.newMedia,
                postId: post.id,
                title: draft.title,
              },
              {
                onSuccess: () => {
                  setIsEditing(false);
                  void Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success,
                  );
                },
                onError: () =>
                  showToast("Couldn't save your changes. Try again."),
              },
            )
          }
          subforums={subforumNames}
          submitLabel='Save'
        />
      </Sheet>

      {pinAction ? null : (
        <PinExplainerModal
          onCancel={() => setPinExplainerOpen(false)}
          onConfirm={confirmPinFromExplainer}
          visible={pinExplainerOpen}
        />
      )}

      {toast ? (
        <View
          className='absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3'
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon color='rgb(250,250,250)' name='CheckCircle' size={16} />
          <Text className='flex-1 text-[14px] text-primary-foreground'>
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
