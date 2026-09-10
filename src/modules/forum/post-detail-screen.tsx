import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { CommentComposer } from '@/src/components/shared/comment-composer';
import { CommentItem } from '@/src/components/shared/comment-item';
import { EditedMark } from '@/src/components/shared/edited-mark';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import {
  ReportSheetContent,
  type ReportSubmission,
} from '@/src/components/shared/report-sheet';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { categoryAccent } from '@/src/lib/category-accent';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { BookmarkButton } from '@/src/modules/bookmarks';
import {
  useBlockUser,
  useOpenProfile,
  useReportMember,
} from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

import { PinExplainerModal } from './pin-explainer-modal';
import { PostComposer } from './post-composer';
import {
  useCreateComment,
  useDeleteComment,
  usePostComments,
  useReportComment,
  useUpdateComment,
  type ForumComment,
} from './use-comments';
import {
  useDeletePost,
  usePost,
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
  // True when reached from Notifications (see app/notification/post/[id].tsx)
  // -- see petition-detail-screen.tsx's identical prop for why.
  readonly modal?: boolean;
}

export function PostDetailScreen({
  modal = false,
  onBack,
  postId,
}: PostDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const postQuery = usePost(postId);
  const post = postQuery.data?.post;
  const comments = usePostComments(postId);
  const createComment = useCreateComment(postId);
  const updateComment = useUpdateComment(postId);
  const deleteComment = useDeleteComment(postId);
  const reportComment = useReportComment();
  const toggleLike = useToggleLike();
  const togglePin = useTogglePin();
  const pinExplainer = usePinExplainerDismissed();
  const updatePost = useUpdatePost();
  const deletePost = useDeletePost();
  const blockUser = useBlockUser();
  const reportPost = useReportPost();
  const reportMember = useReportMember();
  const subforums = useSubforums();
  const subforumNames = (subforums.data?.subforums ?? []).filter(
    (name) => name !== 'All',
  );

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<ForumComment | null>(
    null,
  );
  const [actionsFor, setActionsFor] = useState<ForumComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // A single Sheet whose content switches by mode, rather than separate Sheet
  // (or Sheet + native Modal) instances -- closing one and opening another in
  // quick succession briefly presents two native Modals at once (a Sheet
  // stays mounted, rendering its own full-screen Modal, until its close
  // animation finishes), which corrupts UIKit's presentation stack and can
  // leave the screen permanently unresponsive. One Sheet mounted at a time
  // can never race itself this way -- applies to both the post's own
  // menu/edit/delete-confirm flow and the comment actions/delete-confirm flow.
  const [postSheetMode, setPostSheetMode] = useState<
    'menu' | 'edit' | 'confirm-delete' | 'report' | null
  >(null);
  // Which target a postSheetMode of 'report' is for -- the post itself, or
  // its author.
  const [postReportTarget, setPostReportTarget] = useState<
    'post' | 'user' | null
  >(null);
  const [commentSheetMode, setCommentSheetMode] = useState<
    'actions' | 'confirm-delete' | 'report' | null
  >(null);
  // Which target a commentSheetMode of 'report' is for -- the comment
  // itself, or its author.
  const [commentReportTarget, setCommentReportTarget] = useState<
    'comment' | 'user' | null
  >(null);
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
    setPostSheetMode('edit');
  };

  const handleDeletePost = () => {
    setPostSheetMode('confirm-delete');
  };

  const confirmDeletePost = () => {
    if (!post) {
      return;
    }
    setPostSheetMode(null);
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

  const handleBlockPost = () => {
    if (!post) {
      return;
    }
    setPostSheetMode(null);
    blockUser.mutate(post.author.id, {
      onSuccess: () => showToast(`Blocked ${post.author.name}`),
      onError: () => showToast('Couldn’t block this neighbour. Try again.'),
    });
  };

  const openReportPost = () => {
    setPostReportTarget('post');
    setPostSheetMode('report');
  };

  const openReportPostAuthor = () => {
    setPostReportTarget('user');
    setPostSheetMode('report');
  };

  const handlePostReportSubmit = (submission: ReportSubmission) => {
    if (!post) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setPostSheetMode(null);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (postReportTarget === 'user') {
      reportMember.mutate(
        { reportedUserId: post.author.id, ...submission },
        onSettled,
      );
      return;
    }
    reportPost.mutate({ postId: post.id, ...submission }, onSettled);
  };

  const handleReply = (name: string) => {
    setEditingComment(null);
    setReplyTo(name);
    setDraft((current) => (current.length === 0 ? `@${name} ` : current));
  };

  const handleSend = () => {
    const body = draft.trim();
    if (!body) {
      return;
    }
    if (editingComment) {
      updateComment.mutate(
        { body, commentId: editingComment.id },
        {
          onSuccess: () => {
            setDraft('');
            setEditingComment(null);
            void Haptics.selectionAsync();
          },
          onError: () => showToast("Couldn't save your changes. Try again."),
        },
      );
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

  const openCommentActions = (comment: ForumComment) => {
    setActionsFor(comment);
    setCommentSheetMode('actions');
  };

  const openReportComment = () => {
    setCommentReportTarget('comment');
    setCommentSheetMode('report');
  };

  const openReportCommentAuthor = () => {
    setCommentReportTarget('user');
    setCommentSheetMode('report');
  };

  const handleCommentReportSubmit = (submission: ReportSubmission) => {
    const target = actionsFor;
    if (!target) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setCommentSheetMode(null);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (commentReportTarget === 'user') {
      reportMember.mutate(
        { reportedUserId: target.author.id, ...submission },
        onSettled,
      );
      return;
    }
    reportComment.mutate({ commentId: target.id, ...submission }, onSettled);
  };

  const closeCommentActions = () => setCommentSheetMode(null);

  const handleStartEditComment = (comment: ForumComment) => {
    setCommentSheetMode(null);
    setReplyTo(null);
    setEditingComment(comment);
    setDraft(comment.body);
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
    setDraft('');
  };

  const handleRequestDeleteComment = () => {
    setCommentSheetMode('confirm-delete');
  };

  const confirmDeleteComment = () => {
    const target = actionsFor;
    setCommentSheetMode(null);
    if (!target) {
      return;
    }
    deleteComment.mutate(target.id, {
      onError: () => showToast('Couldn’t delete this comment. Try again.'),
    });
  };

  const openAuthorProfile = () => {
    if (!post) {
      return;
    }
    openProfile(post.author.id, post.author.name);
  };

  const commentList =
    comments.data?.pages.flatMap((page) => page.comments) ?? [];
  const commentsToRender =
    !comments.isPending && !comments.isError ? commentList : [];

  return (
    <View className="flex-1 bg-canvas">
      <HStack
        className={`items-center gap-2 px-[18px] pb-3 ${modal ? '' : 'border-b border-line'}`}
        collapsable={false}
        style={{ paddingTop: modal ? 24 : insets.top + 8 }}
      >
        {modal ? null : (
          <Pressable accessibilityLabel="Back" onPress={onBack}>
            <Icon name="ChevronLeft" size={22} />
          </Pressable>
        )}
        <Heading className="flex-1 font-inter-bold text-[16px]" size="sm">
          Post
        </Heading>
        <BookmarkButton size={18} targetId={postId} targetType="post" />
        <Pressable
          accessibilityLabel="Share post"
          accessibilityRole="button"
          onPress={() => {
            if (!post) {
              return;
            }
            void Share.share({ message: `${post.title}\n\n${post.excerpt}` });
          }}
        >
          <Icon color="rgb(120,108,94)" name="Share" size={18} />
        </Pressable>
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
            ActivitySectionList for why: only comment rows actually on/near
            screen mount as real native views here, no matter how long the
            discussion under a post grows. The post card and comments header
            render once as ListHeaderComponent. */}
        <FlatList
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 16 }}
          data={commentsToRender}
          keyExtractor={(comment) => comment.id}
          ListFooterComponent={
            commentsToRender.length === 0 ? null : (
              <View className="px-[18px]">
                {comments.hasNextPage ? (
                  comments.isFetchingNextPage ? (
                    <View
                      className="items-center py-3"
                      testID="comments-load-more"
                    >
                      <Spinner size="small" />
                    </View>
                  ) : null
                ) : (
                  <AllCaughtUp />
                )}
              </View>
            )
          }
          ListHeaderComponent={
            <VStack className="gap-4 px-[18px] pt-4">
              {post ? (
                <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
                  <HStack className="items-center" space="sm">
                    <Pressable
                      accessibilityLabel={
                        userId === post.author.id
                          ? 'Open your profile'
                          : `Open ${post.author.name}'s profile`
                      }
                      accessibilityRole="button"
                      className="flex-1 flex-row items-center gap-2"
                      onPress={openAuthorProfile}
                    >
                      <Avatar
                        name={post.author.name}
                        size="sm"
                        src={post.author.avatarUrl ?? undefined}
                      />
                      <VStack className="flex-1 gap-0.5">
                        <HStack className="items-center" space="xs">
                          <Text className="font-inter-bold text-[14px] text-content">
                            {post.author.name}
                          </Text>
                          <AdminBadge isAdmin={post.author.isAdmin} />
                        </HStack>
                        <HStack className="items-center" space="xs">
                          <Badge variant={categoryAccent(post.forum)}>
                            {post.forum}
                          </Badge>
                          <Text className="text-[12px] text-text-muted">
                            · {formatRelativeTime(post.createdAt)}
                          </Text>
                          <EditedMark editedAt={post.editedAt} />
                        </HStack>
                      </VStack>
                    </Pressable>
                    <HStack className="items-center" space="sm">
                      <Pressable
                        accessibilityLabel={
                          post.pinned ? 'Unpin post' : 'Pin post'
                        }
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={requestTogglePin}
                      >
                        <Icon
                          color={post.pinned ? COLOR_AMBER : COLOR_TEXT_SUBTLE}
                          fill={post.pinned ? COLOR_AMBER : 'none'}
                          name="Pin"
                          size={16}
                        />
                      </Pressable>
                      <Pressable
                        accessibilityLabel="More options"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => setPostSheetMode('menu')}
                      >
                        <Icon
                          color={COLOR_TEXT_SUBTLE}
                          name="ThreeDots"
                          size={16}
                        />
                      </Pressable>
                    </HStack>
                  </HStack>

                  {post.media && post.media.length > 0 && (
                    <MediaGallery media={post.media} />
                  )}

                  <Heading
                    className="font-inter-bold tracking-[-0.4px]"
                    size="lg"
                  >
                    {post.title}
                  </Heading>
                  {post.excerpt ? (
                    <Text className="text-[15px] leading-[22px] text-muted-foreground">
                      {post.excerpt}
                    </Text>
                  ) : null}
                  <HStack className="items-center" space="sm">
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
                        name="Favourite"
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
                    <HStack className="flex-row items-center gap-1.5 rounded-full bg-secondary px-3 py-[7px]">
                      <Icon
                        color="rgb(37,30,23)"
                        name="MessageCircle"
                        size={14}
                      />
                      <Text className="font-inter-semibold text-[12px] leading-[16px] text-content">
                        {post.replies}
                      </Text>
                    </HStack>
                  </HStack>
                </VStack>
              ) : postQuery.isPending ? (
                <View className="items-center py-10">
                  <Spinner size="xlarge" />
                </View>
              ) : (
                <Text className="text-text-muted" size="sm">
                  This post is no longer available.
                </Text>
              )}

              <Divider />
              <Text className="font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                {post?.replies ?? commentList.length} comments
              </Text>

              {comments.isPending ? (
                <View className="items-center py-10">
                  <Spinner size="xlarge" />
                </View>
              ) : comments.isError ? (
                <VStack
                  className="items-start gap-2 py-2"
                  testID="comments-error"
                >
                  <Text className="text-text-muted" size="sm">
                    Couldn&apos;t load comments.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-full border border-line px-3 py-2"
                    onPress={() => void comments.refetch()}
                    testID="comments-retry"
                  >
                    <Text
                      className="font-inter-semibold text-content"
                      size="xs"
                    >
                      Retry
                    </Text>
                  </Pressable>
                </VStack>
              ) : commentList.length === 0 ? (
                <Text className="py-2 text-text-muted" size="sm">
                  No comments yet — start the conversation.
                </Text>
              ) : null}
            </VStack>
          }
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetchingNextPage) {
              void comments.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          onRefresh={() => {
            void postQuery.refetch();
            void comments.refetch();
          }}
          refreshing={postQuery.isRefetching || comments.isRefetching}
          renderItem={({ item }) => (
            <View className="mb-4 px-[18px]">
              <CommentItem
                comment={item}
                onActions={openCommentActions}
                onOpenAuthor={(authorId) =>
                  openProfile(authorId, item.author.name)
                }
                onReply={handleReply}
              />
            </View>
          )}
        />

        <CommentComposer
          editing={editingComment !== null}
          isSending={
            editingComment ? updateComment.isPending : createComment.isPending
          }
          onCancelEdit={handleCancelEditComment}
          onChangeText={setDraft}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          replyTo={replyTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      <Sheet onClose={closeCommentActions} visible={commentSheetMode !== null}>
        {(maxContentHeight) => commentSheetMode === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              commentReportTarget === 'user'
                ? reportMember.isPending
                : reportComment.isPending
            }
            maxContentHeight={maxContentHeight}
            onSubmit={handleCommentReportSubmit}
            title={
              commentReportTarget === 'user' && actionsFor
                ? `Report ${actionsFor.author.name}`
                : 'Report comment'
            }
          />
        ) : commentSheetMode === 'confirm-delete' ? (
          <View className="gap-1 px-[18px] pb-4 pt-1">
            <Text className="font-inter-bold text-[17px] text-content">
              Delete comment?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setCommentSheetMode(null)}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDeleteComment}>
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: COLOR_DESTRUCTIVE }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            <SheetRow
              icon="Link"
              label="Copy link to comment"
              onPress={() => {
                closeCommentActions();
                showToast('Link copied');
              }}
            />
            <Divider />
            {actionsFor && actionsFor.author.id === userId ? (
              <>
                <SheetRow
                  icon="Edit"
                  label="Edit comment"
                  onPress={() =>
                    actionsFor && handleStartEditComment(actionsFor)
                  }
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="AlertCircle"
                  label="Delete comment"
                  onPress={handleRequestDeleteComment}
                />
              </>
            ) : (
              <>
                <SheetRow
                  icon="EyeOff"
                  label="Block this neighbour"
                  onPress={() => {
                    const target = actionsFor;
                    closeCommentActions();
                    if (!target) return;
                    blockUser.mutate(target.author.id, {
                      onError: () =>
                        showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () =>
                        showToast(`Blocked ${target.author.name}`),
                    });
                  }}
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="Flag"
                  label="Report this user"
                  onPress={openReportCommentAuthor}
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="AlertCircle"
                  label="Report comment"
                  onPress={openReportComment}
                />
              </>
            )}
          </View>
        )}
      </Sheet>

      <Sheet
        onClose={() => setPostSheetMode(null)}
        visible={postSheetMode !== null}
      >
        {(maxContentHeight) => postSheetMode === 'edit' && post ? (
          <PostComposer
            forum={post.forum}
            initialExcerpt={post.excerpt}
            initialMedia={post.media}
            initialTitle={post.title}
            isSubmitting={updatePost.isPending}
            maxContentHeight={maxContentHeight}
            onDismiss={() => setPostSheetMode(null)}
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
                    setPostSheetMode(null);
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
            submitLabel="Save"
          />
        ) : postSheetMode === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              postReportTarget === 'user'
                ? reportMember.isPending
                : reportPost.isPending
            }
            maxContentHeight={maxContentHeight}
            onSubmit={handlePostReportSubmit}
            title={
              postReportTarget === 'user' && post
                ? `Report ${post.author.name}`
                : 'Report post'
            }
          />
        ) : postSheetMode === 'confirm-delete' ? (
          <View className="gap-1 px-[18px] pb-4 pt-1">
            <Text className="font-inter-bold text-[17px] text-content">
              Delete post?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setPostSheetMode(null)}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDeletePost}>
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: COLOR_DESTRUCTIVE }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {isOwnPost ? (
              <>
                <SheetRow
                  icon="Edit"
                  label="Edit post"
                  onPress={handleEditPost}
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="AlertCircle"
                  label="Delete post"
                  onPress={handleDeletePost}
                />
              </>
            ) : (
              <>
                <SheetRow
                  icon="EyeOff"
                  label="Block this neighbour"
                  onPress={handleBlockPost}
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="Flag"
                  label="Report this user"
                  onPress={openReportPostAuthor}
                />
                <Divider />
                <SheetRow
                  destructive
                  icon="AlertCircle"
                  label="Report post"
                  onPress={openReportPost}
                />
              </>
            )}
          </View>
        )}
      </Sheet>

      <PinExplainerModal
        onCancel={() => setPinExplainerOpen(false)}
        onConfirm={confirmPinFromExplainer}
        visible={pinExplainerOpen}
      />

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon color="rgb(250,250,250)" name="CheckCircle" size={16} />
          <Text className="flex-1 text-[14px] text-primary-foreground">
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface SheetRowProps {
  readonly icon: AppIconName;
  readonly label: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}

function SheetRow({ icon, label, onPress, destructive }: SheetRowProps) {
  const color = destructive ? 'rgb(231,0,11)' : 'rgb(37,30,23)';
  return (
    <Pressable
      className="flex-row items-center gap-3 px-1.5 py-3.5"
      onPress={onPress}
    >
      <Icon color={color} name={icon} size={20} />
      <Text
        className="text-[15px]"
        style={{ color, fontWeight: destructive ? '500' : '400' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
