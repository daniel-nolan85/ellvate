import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { CommentComposer } from '@/src/components/shared/comment-composer';
import { CommentItem } from '@/src/components/shared/comment-item';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import {
  ReportSheetContent,
  type ReportSubmission,
} from '@/src/components/shared/report-sheet';
import { Badge } from '@/src/components/ui/badge';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import {
  formatRelativeTime,
  formatRelativeTimeUntil,
} from '@/src/lib/relative-time';
import { BookmarkButton } from '@/src/modules/bookmarks';
import {
  useBlockUser,
  useOpenProfile,
  useReportMember,
} from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

import {
  useCreatePetitionComment,
  useDeletePetitionComment,
  usePetitionComments,
  useReportPetitionComment,
  useUpdatePetitionComment,
  type PetitionComment,
} from './use-petition-comments';
import {
  usePetition,
  useReportPetition,
  useToggleSignature,
} from './use-petitions';
import { PETITION_CATEGORIES } from './petitions-types';

const categoryLabel = (value: string): string =>
  PETITION_CATEGORIES.find((option) => option.value === value)?.label ?? value;

interface PetitionDetailScreenProps {
  readonly petitionId: string;
  readonly onBack: () => void;
  // True when reached from Notifications (see
  // app/notification/petition/[id].tsx), presented as a formSheet whose own
  // grabber, swipe-to-dismiss, and tap-outside already cover closing it --
  // hides the back button and swaps insets.top for a small fixed gap,
  // matching every other formSheet header in this app (Digest, Member
  // Profile, ...) instead of double-padding under the sheet's own inset.
  readonly modal?: boolean;
}

export function PetitionDetailScreen({
  modal = false,
  onBack,
  petitionId,
}: PetitionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const petitionQuery = usePetition(petitionId);
  const petition = petitionQuery.data?.petition;
  const toggleSignature = useToggleSignature();
  const reportPetition = useReportPetition();
  const blockUser = useBlockUser();
  const reportMember = useReportMember();

  const comments = usePetitionComments(petitionId);
  const createComment = useCreatePetitionComment(petitionId);
  const updateComment = useUpdatePetitionComment(petitionId);
  const deleteComment = useDeletePetitionComment(petitionId);
  const reportComment = useReportPetitionComment();

  const [menuOpen, setMenuOpen] = useState(false);
  // Which content the petition-options Sheet shows -- the block/report menu,
  // or the report form for whichever target was picked from it.
  const [petitionSheetView, setPetitionSheetView] = useState<'menu' | 'report'>(
    'menu',
  );
  const [petitionReportTarget, setPetitionReportTarget] = useState<
    'petition' | 'user' | null
  >(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<PetitionComment | null>(
    null,
  );
  const [actionsFor, setActionsFor] = useState<PetitionComment | null>(null);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  // Which content the comment-actions Sheet shows -- see petitionSheetView.
  const [commentSheetView, setCommentSheetView] = useState<
    'actions' | 'report'
  >('actions');
  const [commentReportTarget, setCommentReportTarget] = useState<
    'comment' | 'user' | null
  >(null);
  const [commentPendingDelete, setCommentPendingDelete] =
    useState<PetitionComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const commentList =
    comments.data?.pages.flatMap((page) => page.comments) ?? [];
  const commentsToRender = petition && !comments.isPending ? commentList : [];

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
          onError: () => showToast("Couldn't save your changes. Try again."),
          onSuccess: () => {
            setDraft('');
            setEditingComment(null);
            void Haptics.selectionAsync();
          },
        },
      );
      return;
    }
    createComment.mutate(body, {
      onError: () => showToast('Couldn’t post your comment. Try again.'),
      onSuccess: () => {
        setDraft('');
        setReplyTo(null);
        void Haptics.selectionAsync();
      },
    });
  };

  const openCommentActions = (comment: PetitionComment) => {
    setActionsFor(comment);
    setCommentSheetView('actions');
    setActionsSheetOpen(true);
  };
  const closeCommentActions = () => {
    setActionsSheetOpen(false);
    setCommentSheetView('actions');
  };

  const openReportComment = () => {
    setCommentReportTarget('comment');
    setCommentSheetView('report');
  };

  const openReportCommentAuthor = () => {
    setCommentReportTarget('user');
    setCommentSheetView('report');
  };

  const handleCommentReportSubmit = (submission: ReportSubmission) => {
    const target = actionsFor;
    if (!target) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        closeCommentActions();
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

  const handleStartEditComment = (comment: PetitionComment) => {
    setActionsSheetOpen(false);
    setReplyTo(null);
    setEditingComment(comment);
    setDraft(comment.body);
  };

  const handleRequestDeleteComment = () => {
    const target = actionsFor;
    setActionsSheetOpen(false);
    if (target) {
      setCommentPendingDelete(target);
    }
  };

  const confirmDeleteComment = () => {
    const target = commentPendingDelete;
    setCommentPendingDelete(null);
    if (!target) {
      return;
    }
    deleteComment.mutate(target.id, {
      onError: () => showToast('Couldn’t delete this comment. Try again.'),
    });
  };

  const openReportPetition = () => {
    setPetitionReportTarget('petition');
    setPetitionSheetView('report');
  };

  const openReportPetitionAuthor = () => {
    setPetitionReportTarget('user');
    setPetitionSheetView('report');
  };

  const handlePetitionReportSubmit = (submission: ReportSubmission) => {
    if (!petition) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setMenuOpen(false);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (petitionReportTarget === 'user') {
      reportMember.mutate(
        { reportedUserId: petition.createdBy.id, ...submission },
        onSettled,
      );
      return;
    }
    reportPetition.mutate({ petitionId, ...submission }, onSettled);
  };

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
          Petition
        </Heading>
        <BookmarkButton size={18} targetId={petitionId} targetType="petition" />
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
            ActivitySectionList for why: only comment rows actually on/near
            screen mount as real native views here, no matter how long the
            discussion under a petition grows. The petition card and
            discussion header render once as ListHeaderComponent. */}
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
                    <View className="items-center py-3">
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
              {petition ? (
                <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
                  {petition.media && petition.media.length > 0 && (
                    <MediaGallery media={petition.media} />
                  )}

                  <HStack className="items-center" space="xs">
                    <HStack className="flex-1 items-center" space="xs">
                      <Badge variant="muted">
                        {categoryLabel(petition.category)}
                      </Badge>
                      {petition.status === 'succeeded' ? (
                        <Badge variant="success">Succeeded</Badge>
                      ) : null}
                      {petition.status === 'expired' ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : null}
                    </HStack>
                    <Pressable
                      accessibilityLabel="More options"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => setMenuOpen(true)}
                    >
                      <Icon
                        color="rgb(169,156,139)"
                        name="ThreeDots"
                        size={16}
                      />
                    </Pressable>
                  </HStack>

                  <Heading className="font-inter-bold text-[22px]" size="lg">
                    {petition.title}
                  </Heading>

                  <Pressable
                    accessibilityLabel={`Started by ${petition.createdBy.name}`}
                    accessibilityRole="button"
                    className="flex-row items-center gap-1.5"
                    onPress={() =>
                      openProfile(
                        petition.createdBy.id,
                        petition.createdBy.name,
                      )
                    }
                  >
                    <Text className="text-[13px] text-text-muted">
                      Started by{' '}
                      <Text className="font-inter-semibold text-content">
                        {petition.createdBy.name}
                      </Text>
                    </Text>
                    <AdminBadge isAdmin={petition.createdBy.isAdmin} />
                  </Pressable>

                  <Text className="text-[14px] leading-5 text-content">
                    {petition.description}
                  </Text>

                  <HStack className="items-center gap-1.5">
                    <Icon color="rgb(120,108,94)" name="Clock" size={16} />
                    <Text className="text-[14px] text-text-muted">
                      {petition.status === 'open'
                        ? `Closes ${formatRelativeTimeUntil(petition.deadlineAt)}`
                        : `${petition.status === 'succeeded' ? 'Succeeded' : 'Closed'} ${formatRelativeTime(petition.succeededAt ?? petition.deadlineAt)}`}
                    </Text>
                  </HStack>

                  <Divider />

                  <VStack space="xs">
                    <View className="h-2 overflow-hidden rounded-full bg-secondary">
                      <View
                        className="h-full rounded-full bg-accent"
                        style={{
                          width: `${Math.min(100, Math.round((petition.signatureCount / petition.requiredSignatures) * 100))}%`,
                        }}
                      />
                    </View>
                    <Text className="text-[13px] text-text-muted">
                      {petition.signatureCount} of {petition.requiredSignatures}{' '}
                      signatures
                    </Text>
                    <Text className="text-[12px] text-text-muted">
                      That&rsquo;s 20% of the community — the goal was set when
                      this petition started and won&rsquo;t change.
                    </Text>
                  </VStack>

                  <Text className="text-[12px] leading-4 text-text-muted">
                    Reaching the goal sends this to the HOA board as a
                    respectful request for consideration, reviewed by an admin
                    first — not a guarantee of any particular outcome or
                    timeline. The community will be updated here once the
                    petition succeeds, and again if the board responds.
                  </Text>

                  {petition.hoaResponse ? (
                    <VStack
                      className="gap-1.5 rounded-[14px] bg-secondary p-3.5"
                      space="xs"
                    >
                      <HStack className="items-center gap-1.5">
                        <Icon
                          color="rgb(120,108,94)"
                          name="MessageCircle"
                          size={14}
                        />
                        <Text className="font-inter-semibold text-[12px] uppercase tracking-[0.5px] text-text-muted">
                          HOA board response
                        </Text>
                      </HStack>
                      <Text className="text-[14px] leading-5 text-content">
                        {petition.hoaResponse}
                      </Text>
                    </VStack>
                  ) : null}

                  {petition.status === 'open' ? (
                    <Pressable
                      accessibilityRole="button"
                      className={`items-center rounded-full px-5 py-3 ${
                        petition.signed ? 'bg-success' : 'bg-accent'
                      }`}
                      disabled={toggleSignature.isPending}
                      onPress={() => toggleSignature.mutate(petition.id)}
                      style={{ opacity: toggleSignature.isPending ? 0.6 : 1 }}
                    >
                      <Text className="font-inter-semibold text-[14px] text-accent-foreground">
                        {petition.signed ? 'Signed ✓' : 'Sign this petition'}
                      </Text>
                    </Pressable>
                  ) : null}
                </VStack>
              ) : petitionQuery.isPending ? (
                <View className="items-center py-10">
                  <Spinner size="xlarge" />
                </View>
              ) : (
                <Text className="text-text-muted" size="sm">
                  This petition is no longer available.
                </Text>
              )}

              {petition ? (
                <>
                  <Divider />
                  <Text className="font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                    {petition.status === 'succeeded'
                      ? 'What happened'
                      : 'Discussion'}{' '}
                    — {commentList.length} comments
                  </Text>
                  <Text className="text-[12px] leading-4 text-text-muted">
                    {petition.status === 'succeeded'
                      ? 'Share updates on what actually happened — keep it constructive and focused on outcomes, not individuals.'
                      : 'Share info, support, or concerns about this petition — keep it constructive and focused on the issue, not individuals.'}
                  </Text>

                  {comments.isPending ? (
                    <View className="items-center py-10">
                      <Spinner size="xlarge" />
                    </View>
                  ) : commentList.length === 0 ? (
                    <Text className="py-2 text-text-muted" size="sm">
                      {petition.status === 'succeeded'
                        ? 'No updates yet — be the first to share what happened.'
                        : 'No comments yet — be the first to share your thoughts.'}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </VStack>
          }
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetchingNextPage) {
              void comments.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
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

        {petition ? (
          <CommentComposer
            editing={editingComment !== null}
            isSending={
              editingComment ? updateComment.isPending : createComment.isPending
            }
            onCancelEdit={() => {
              setEditingComment(null);
              setDraft('');
            }}
            onChangeText={setDraft}
            onClearReply={() => setReplyTo(null)}
            onSend={handleSend}
            replyTo={replyTo}
            value={draft}
          />
        ) : null}
      </KeyboardAvoidingView>

      {/* Petition options menu -- one Sheet, content switches by view (see
          petitionSheetView) rather than a second Sheet instance, matching
          this screen's other Sheets. */}
      <Sheet
        onClose={() => {
          setMenuOpen(false);
          setPetitionSheetView('menu');
        }}
        visible={menuOpen}
      >
        {petitionSheetView === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              petitionReportTarget === 'user'
                ? reportMember.isPending
                : reportPetition.isPending
            }
            onSubmit={handlePetitionReportSubmit}
            title={
              petitionReportTarget === 'user' && petition
                ? `Report ${petition.createdBy.name}`
                : 'Report petition'
            }
          />
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {petition && petition.createdBy.id !== userId ? (
              <>
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={() => {
                    setMenuOpen(false);
                    blockUser.mutate(petition.createdBy.id, {
                      onError: () =>
                        showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () =>
                        showToast(`Blocked ${petition.createdBy.name}`),
                    });
                  }}
                >
                  <Icon name="EyeOff" size={20} />
                  <Text className="text-[15px]">Block this neighbour</Text>
                </Pressable>
                <Divider />
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={openReportPetitionAuthor}
                >
                  <Icon color="rgb(231,0,11)" name="Flag" size={20} />
                  <Text
                    className="text-[15px]"
                    style={{ color: 'rgb(231,0,11)' }}
                  >
                    Report this user
                  </Text>
                </Pressable>
                <Divider />
              </>
            ) : null}
            <Pressable
              className="flex-row items-center gap-3 px-1.5 py-3.5"
              onPress={openReportPetition}
            >
              <Icon color="rgb(231,0,11)" name="AlertCircle" size={20} />
              <Text className="text-[15px]" style={{ color: 'rgb(231,0,11)' }}>
                Report petition
              </Text>
            </Pressable>
          </View>
        )}
      </Sheet>

      {/* Comment actions */}
      <Sheet onClose={closeCommentActions} visible={actionsSheetOpen}>
        {commentSheetView === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              commentReportTarget === 'user'
                ? reportMember.isPending
                : reportComment.isPending
            }
            onSubmit={handleCommentReportSubmit}
            title={
              commentReportTarget === 'user' && actionsFor
                ? `Report ${actionsFor.author.name}`
                : 'Report comment'
            }
          />
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {actionsFor && actionsFor.author.id === userId ? (
              <>
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={() =>
                    actionsFor && handleStartEditComment(actionsFor)
                  }
                >
                  <Icon name="Edit" size={20} />
                  <Text className="text-[15px]">Edit comment</Text>
                </Pressable>
                <Divider />
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={handleRequestDeleteComment}
                >
                  <Icon color="rgb(231,0,11)" name="AlertCircle" size={20} />
                  <Text
                    className="text-[15px]"
                    style={{ color: 'rgb(231,0,11)' }}
                  >
                    Delete comment
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
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
                >
                  <Icon name="EyeOff" size={20} />
                  <Text className="text-[15px]">Block this neighbour</Text>
                </Pressable>
                <Divider />
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={openReportCommentAuthor}
                >
                  <Icon color="rgb(231,0,11)" name="Flag" size={20} />
                  <Text
                    className="text-[15px]"
                    style={{ color: 'rgb(231,0,11)' }}
                  >
                    Report this user
                  </Text>
                </Pressable>
                <Divider />
                <Pressable
                  className="flex-row items-center gap-3 px-1.5 py-3.5"
                  onPress={openReportComment}
                >
                  <Icon color="rgb(231,0,11)" name="AlertCircle" size={20} />
                  <Text
                    className="text-[15px]"
                    style={{ color: 'rgb(231,0,11)' }}
                  >
                    Report comment
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </Sheet>

      {/* Delete-comment confirmation */}
      <Modal
        animationType="fade"
        onRequestClose={() => setCommentPendingDelete(null)}
        transparent
        visible={commentPendingDelete !== null}
      >
        <Pressable
          className="flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8"
          onPress={() => setCommentPendingDelete(null)}
        >
          <Pressable
            className="w-full gap-1 rounded-[20px] bg-paper p-5"
            onPress={(pressEvent) => pressEvent.stopPropagation()}
          >
            <Text className="font-inter-bold text-[17px] text-content">
              Delete comment?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setCommentPendingDelete(null)}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDeleteComment}>
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 24 }}
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
