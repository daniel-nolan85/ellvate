import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { CommentComposer } from '@/src/components/shared/comment-composer';
import { CommentItem } from '@/src/components/shared/comment-item';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { categoryAccent } from '@/src/lib/category-accent';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useOpenProfile } from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

import { PinExplainerModal } from './pin-explainer-modal';
import { PostComposer } from './post-composer';
import {
  useCreateComment,
  useDeleteComment,
  usePostComments,
  useReportComment,
  type ForumComment,
} from './use-comments';
import {
  useDeletePost,
  useForumPosts,
  useMuteUser,
  useReportPost,
  useSubforums,
  useTogglePin,
  useToggleLike,
  useUpdatePost,
} from './use-forum';
import { usePinExplainerDismissed } from './use-pin-explainer';

const COLOR_TEXT_SUBTLE = 'rgb(120,108,94)';
const COLOR_AMBER = 'rgb(217,123,41)';
const COLOR_DESTRUCTIVE = 'rgb(231,0,11)';

interface PostDetailScreenProps {
  readonly postId: string;
  readonly onBack: () => void;
}

export function PostDetailScreen({ postId, onBack }: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const posts = useForumPosts('All');
  const post = useMemo(
    () => posts.data?.posts.find((entry) => entry.id === postId),
    [posts.data, postId],
  );
  const comments = usePostComments(postId);
  const createComment = useCreateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const reportComment = useReportComment();
  const toggleLike = useToggleLike();
  const togglePin = useTogglePin();
  const pinExplainer = usePinExplainerDismissed();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const muteUser = useMuteUser();
  const reportPost = useReportPost();
  const subforums = useSubforums();
  const subforumNames = (subforums.data?.subforums ?? []).filter(
    (name) => name !== 'All',
  );

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<ForumComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pinExplainerOpen, setPinExplainerOpen] = useState(false);

  const isOwnPost = post !== undefined && userId === post.author.id;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleTogglePin = () => {
    if (!post) {
      return;
    }
    togglePin.mutate(post.id, {
      onSuccess: (result) =>
        showToast(result.pinned ? 'Post pinned' : 'Post unpinned'),
      onError: () => showToast('Couldn’t update pin status. Try again.'),
    });
  };

  const requestTogglePin = () => {
    if (post && !post.pinned && !pinExplainer.dismissed) {
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

  const handleEditPost = () => {
    setPostMenuOpen(false);
    setIsEditingPost(true);
  };

  const handleDeletePost = () => {
    setPostMenuOpen(false);
    setConfirmDeleteOpen(true);
  };

  const confirmDeletePost = () => {
    if (!post) {
      return;
    }
    setConfirmDeleteOpen(false);
    deletePost.mutate(post.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        onBack();
      },
      onError: () => showToast('Couldn’t delete this post. Try again.'),
    });
  };

  const handleMutePost = () => {
    if (!post) {
      return;
    }
    setPostMenuOpen(false);
    muteUser.mutate(post.author.id, {
      onSuccess: () => showToast(`Muted ${post.author.name}`),
      onError: () => showToast('Couldn’t mute this neighbour. Try again.'),
    });
  };

  const handleReportPost = () => {
    if (!post) {
      return;
    }
    setPostMenuOpen(false);
    reportPost.mutate(post.id, {
      onSuccess: () =>
        showToast('Thanks — our moderators will take a look.'),
      onError: () => showToast('Couldn’t submit your report. Try again.'),
    });
  };

  const handleReply = (name: string) => {
    setReplyTo(name);
    setDraft((current) => (current.length === 0 ? `@${name} ` : current));
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    createComment.mutate(body, {
      onSuccess: () => {
        setDraft('');
        setReplyTo(null);
        void Haptics.selectionAsync();
      },
      onError: () => showToast('Couldn’t post your comment. Try again.'),
    });
  };

  const openAuthorProfile = () => {
    if (!post) {
      return;
    }
    openProfile(post.author.id, post.author.name);
  };

  const commentList = comments.data?.comments ?? [];

  return (
    <View className='flex-1 bg-canvas'>
      <HStack
        className='items-center gap-2 border-b border-line px-[18px] pb-3'
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable accessibilityLabel='Back' onPress={onBack}>
          <Icon name='ChevronLeft' size={22} />
        </Pressable>
        <Heading className='flex-1 font-inter-bold text-[16px]' size='sm'>
          Post
        </Heading>
        <BookmarkButton size={18} targetId={postId} targetType='post' />
        <Pressable
          accessibilityLabel='Share post'
          accessibilityRole='button'
          onPress={() => {
            if (!post) {
              return;
            }
            void Share.share({ message: `${post.title}\n\n${post.excerpt}` });
          }}
        >
          <Icon color='rgb(120,108,94)' name='Share' size={18} />
        </Pressable>
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className='flex-1'
      >
        <ScrollView
          className='flex-1'
          contentContainerClassName='gap-4 px-[18px] py-4'
        >
          {post ? (
            <VStack className='gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
              <HStack className='items-center' space='sm'>
                <Pressable
                  accessibilityLabel={
                    userId === post.author.id
                      ? 'Open your profile'
                      : `Open ${post.author.name}'s profile`
                  }
                  accessibilityRole='button'
                  className='flex-1 flex-row items-center gap-2'
                  onPress={openAuthorProfile}
                >
                  <Avatar name={post.author.name} size='sm' src={post.author.avatarUrl ?? undefined} />
                  <VStack className='flex-1 gap-0.5'>
                    <Text className='font-inter-bold text-[14px] text-content'>
                      {post.author.name}
                    </Text>
                    <HStack className='items-center' space='xs'>
                      <Badge variant={categoryAccent(post.forum)}>{post.forum}</Badge>
                      <Text className='text-[12px] text-text-muted'>
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
                    onPress={requestTogglePin}
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
                    onPress={() => setPostMenuOpen(true)}
                  >
                    <Icon color={COLOR_TEXT_SUBTLE} name='ThreeDots' size={16} />
                  </Pressable>
                </HStack>
              </HStack>

              {post.media && post.media.length > 0 && (
                <MediaGallery media={post.media} />
              )}

              <Heading className='font-inter-bold tracking-[-0.4px]' size='lg'>
                {post.title}
              </Heading>
              {post.excerpt ? (
                <Text className='text-[15px] leading-[22px] text-muted-foreground'>
                  {post.excerpt}
                </Text>
              ) : null}
              <HStack className='items-center' space='sm'>
                <Pressable
                  className={`flex-row items-center gap-1.5 rounded-full px-3 py-[7px] ${
                    post.liked ? 'bg-amber-subtle' : 'bg-secondary'
                  }`}
                  onPress={() =>
                    toggleLike.mutate({ forum: 'All', postId: post.id })
                  }
                >
                  <Icon
                    color={post.liked ? 'rgb(217,123,41)' : 'rgb(37,30,23)'}
                    fill={post.liked ? 'rgb(217,123,41)' : 'none'}
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
                <HStack className='flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-[7px]'>
                  <Icon
                    color='rgb(37,30,23)'
                    name='MessageCircle'
                    size={14}
                  />
                  <Text className='font-inter-semibold text-[12px] leading-[16px] text-content'>
                    {post.replies}
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          ) : posts.isPending ? (
            <View className='items-center py-10'>
              <Spinner />
            </View>
          ) : (
            <Text className='text-text-muted' size='sm'>
              This post is no longer available.
            </Text>
          )}

          <Divider />
          <Text className='font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground'>
            {post?.replies ?? commentList.length} comments
          </Text>

          {comments.isPending ? (
            <View className='items-center py-10'>
              <Spinner size='xlarge' />
            </View>
          ) : comments.isError ? (
            <VStack className='items-start gap-2 py-2' testID='comments-error'>
              <Text className='text-text-muted' size='sm'>
                Couldn&apos;t load comments.
              </Text>
              <Pressable
                accessibilityRole='button'
                className='rounded-full border border-line px-3 py-2'
                onPress={() => void comments.refetch()}
                testID='comments-retry'
              >
                <Text className='font-inter-semibold text-content' size='xs'>
                  Retry
                </Text>
              </Pressable>
            </VStack>
          ) : commentList.length === 0 ? (
            <Text className='py-2 text-text-muted' size='sm'>
              No comments yet — start the conversation.
            </Text>
          ) : (
            <VStack className='gap-4'>
              {commentList.map((comment) => (
                <CommentItem
                  comment={comment}
                  key={comment.id}
                  onActions={setActionsFor}
                  onOpenAuthor={(authorId) =>
                    openProfile(authorId, comment.author.name)
                  }
                  onReply={handleReply}
                />
              ))}
            </VStack>
          )}
        </ScrollView>

        <CommentComposer
          isSending={createComment.isPending}
          onChangeText={setDraft}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          replyTo={replyTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      <Modal
        animationType='fade'
        onRequestClose={() => setActionsFor(null)}
        transparent
        visible={actionsFor !== null}
      >
        <Pressable
          className='flex-1 bg-[rgba(0,0,0,0.4)]'
          onPress={() => setActionsFor(null)}
        />
        <View
          className='absolute bottom-0 left-0 right-0 gap-1 rounded-t-[20px] bg-paper px-[18px] pt-2.5'
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className='mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-line' />
          <SheetRow
            icon='Link'
            label='Copy link to comment'
            onPress={() => {
              setActionsFor(null);
              showToast('Link copied');
            }}
          />
          <Divider />
          <SheetRow
            icon='EyeOff'
            label='Mute this neighbour'
            onPress={() => {
              setActionsFor(null);
              showToast('Muted');
            }}
          />
          <Divider />
          {actionsFor && actionsFor.author.id === userId ? (
            <SheetRow
              destructive
              icon='AlertCircle'
              label='Delete comment'
              onPress={() => {
                const target = actionsFor;
                setActionsFor(null);
                deleteComment.mutate(target.id);
              }}
            />
          ) : (
            <SheetRow
              destructive
              icon='AlertCircle'
              label='Report comment'
              onPress={() => {
                const target = actionsFor;
                setActionsFor(null);
                if (!target) return;
                reportComment.mutate(target.id, {
                  onError: () =>
                    showToast('Couldn’t report this comment. Try again.'),
                  onSuccess: () =>
                    showToast('Thanks — our moderators will take a look.'),
                });
              }}
            />
          )}
        </View>
      </Modal>

      <Modal
        animationType='fade'
        onRequestClose={() => setPostMenuOpen(false)}
        transparent
        visible={postMenuOpen}
      >
        <Pressable
          className='flex-1 bg-[rgba(0,0,0,0.4)]'
          onPress={() => setPostMenuOpen(false)}
        />
        <View
          className='absolute bottom-0 left-0 right-0 gap-1 rounded-t-[20px] bg-paper px-[18px] pt-2.5'
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className='mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-line' />
          {isOwnPost ? (
            <>
              <SheetRow icon='Edit' label='Edit post' onPress={handleEditPost} />
              <Divider />
              <SheetRow
                destructive
                icon='AlertCircle'
                label='Delete post'
                onPress={handleDeletePost}
              />
            </>
          ) : (
            <>
              <SheetRow
                icon='EyeOff'
                label='Mute this neighbour'
                onPress={handleMutePost}
              />
              <Divider />
              <SheetRow
                destructive
                icon='AlertCircle'
                label='Report post'
                onPress={handleReportPost}
              />
            </>
          )}
        </View>
      </Modal>

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
              <Pressable onPress={confirmDeletePost}>
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

      {post ? (
        <Sheet onClose={() => setIsEditingPost(false)} visible={isEditingPost}>
          <PostComposer
            forum={post.forum}
            initialExcerpt={post.excerpt}
            initialMedia={post.media}
            initialTitle={post.title}
            isSubmitting={updatePost.isPending}
            onDismiss={() => setIsEditingPost(false)}
            onSubmit={(draftPost) =>
              updatePost.mutate(
                {
                  excerpt: draftPost.excerpt,
                  existingMedia: draftPost.existingMedia,
                  forum: draftPost.forum,
                  newMedia: draftPost.newMedia,
                  postId: post.id,
                  title: draftPost.title,
                },
                {
                  onSuccess: () => {
                    setIsEditingPost(false);
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
      ) : null}

      <PinExplainerModal
        onCancel={() => setPinExplainerOpen(false)}
        onConfirm={confirmPinFromExplainer}
        visible={pinExplainerOpen}
      />

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

interface SheetRowProps {
  readonly icon: 'Link' | 'EyeOff' | 'AlertCircle' | 'Edit';
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

function SheetRow({ icon, label, onPress, destructive }: SheetRowProps) {
  const color = destructive ? 'rgb(231,0,11)' : 'rgb(37,30,23)';
  return (
    <Pressable
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
