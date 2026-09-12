import { useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';
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
import { Badge, type BadgeVariant } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatDateOnly } from '@/src/lib/date-only';
import { BookmarkButton } from '@/src/modules/bookmarks';
import {
  useBlockUser,
  useOpenProfile,
  useReportMember,
} from '@/src/modules/profile';
import { pickGalleryImages, type PickedImage } from '@/src/platform/media-picker';
import { useSession } from '@/src/platform/session';

import { LevelUpCelebrationModal } from './level-up-celebration-modal';
import { MissionCelebrationModal } from './mission-celebration-modal';
import { MissionCheckInThumbnailRow } from './mission-check-in-gallery';
import { MissionComposer } from './mission-composer';
import { missionThemeIcon } from './mission-theme';
import {
  useCreateMissionComment,
  useDeleteMissionComment,
  useMissionComments,
  useReportMissionComment,
  useUpdateMissionComment,
  type MissionComment,
} from './use-mission-comments';
import {
  useAcceptMission,
  useCheckIn,
  useDeleteMission,
  useMission,
  useReportMission,
  useUpdateMission,
  type CheckInCelebration,
  type MissionStatus,
} from './use-missions';

interface MissionDetailScreenProps {
  readonly missionId: string;
  readonly onBack: () => void;
  // True when reached from Notifications (see
  // app/notification/mission/[id].tsx) -- see petition-detail-screen.tsx's
  // identical prop for why.
  readonly modal?: boolean;
}

const ACCENT = 'rgb(181,80,44)';
const AMBER = 'rgb(217,123,41)';
const WHITE = 'rgb(255,255,255)';

const STATUS_BADGE: Readonly<
  Record<
    MissionStatus,
    { readonly variant: BadgeVariant; readonly label: string }
  >
> = {
  active: { label: 'In progress', variant: 'accent' },
  done: { label: 'Complete', variant: 'success' },
};

function MissionMenuRow({
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
  const color = destructive ? 'rgb(231,0,11)' : 'rgb(37,30,23)';
  return (
    <Pressable
      accessibilityRole="button"
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

export function MissionDetailScreen({
  missionId,
  modal = false,
  onBack,
}: MissionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const [celebration, setCelebration] = useState<CheckInCelebration | null>(
    null,
  );

  const missionQuery = useMission(missionId);
  const acceptMission = useAcceptMission();
  const checkIn = useCheckIn(setCelebration);
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const blockUser = useBlockUser();
  const reportMission = useReportMission();
  const reportMember = useReportMember();
  const comments = useMissionComments(missionId);
  const createComment = useCreateMissionComment(missionId);
  const updateComment = useUpdateMissionComment(missionId);
  const deleteComment = useDeleteMissionComment(missionId);
  const reportComment = useReportMissionComment();

  // A single Sheet whose content switches by mode, rather than separate
  // Sheet/Modal instances -- closing one and opening another in the same
  // tick briefly presents two native Modals at once (a Sheet stays mounted,
  // rendering its own full-screen Modal, until its close animation
  // finishes), which corrupts UIKit's presentation stack and can leave the
  // screen permanently unresponsive. Applies to both the mission's own
  // menu/edit/delete-confirm flow and the comment actions/delete-confirm flow.
  const [sheetMode, setSheetMode] = useState<
    'menu' | 'edit' | 'confirm-delete' | 'report' | null
  >(null);
  // Which target a sheetMode of 'report' is for -- the mission itself, or
  // its author.
  const [missionReportTarget, setMissionReportTarget] = useState<
    'mission' | 'user' | null
  >(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<MissionComment | null>(
    null,
  );
  const [actionsFor, setActionsFor] = useState<MissionComment | null>(null);
  const [commentSheetMode, setCommentSheetMode] = useState<
    'actions' | 'confirm-delete' | 'report' | null
  >(null);
  // Which target a commentSheetMode of 'report' is for -- the comment
  // itself, or its author.
  const [commentReportTarget, setCommentReportTarget] = useState<
    'comment' | 'user' | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);
  const [checkInPhoto, setCheckInPhoto] = useState<PickedImage | null>(null);

  const mission = missionQuery.data?.mission;
  const isOwnMission = !!mission && mission.author.id === userId;

  const done = mission?.status === 'done';
  const badge = mission ? STATUS_BADGE[mission.status] : null;
  const isFinalStop =
    !!mission &&
    mission.status === 'active' &&
    mission.accepted &&
    mission.stopsDone + 1 >= mission.stopsTotal;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleAccept = () => {
    if (!mission) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    acceptMission.mutate(mission.id, {
      onError: () => showToast('Couldn’t accept this mission. Try again.'),
    });
  };

  const handleAttachCheckInPhoto = async () => {
    const [picked] = await pickGalleryImages({ selectionLimit: 1 });
    if (picked) {
      setCheckInPhoto(picked);
    }
  };

  const handleCheckIn = () => {
    if (!mission) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    checkIn.mutate(
      {
        missionId: mission.id,
        photo: checkInPhoto
          ? {
              dataUrl: `data:${checkInPhoto.mimeType};base64,${checkInPhoto.base64}`,
              filename: checkInPhoto.filename,
            }
          : undefined,
      },
      {
        onError: () => showToast('Couldn’t check in. Try again.'),
        onSuccess: () => setCheckInPhoto(null),
      },
    );
  };

  const handleDeleteMission = () => {
    if (!mission) {
      return;
    }
    setSheetMode(null);
    deleteMission.mutate(mission.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        onBack();
      },
      onError: () => showToast('Couldn’t delete this mission. Try again.'),
    });
  };

  const openReportMission = () => {
    setMissionReportTarget('mission');
    setSheetMode('report');
  };

  const openReportMissionAuthor = () => {
    setMissionReportTarget('user');
    setSheetMode('report');
  };

  const handleMissionReportSubmit = (submission: ReportSubmission) => {
    if (!mission) {
      return;
    }
    const onSettled = {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => {
        setSheetMode(null);
        showToast('Thanks — our moderators will take a look.');
      },
    };
    if (missionReportTarget === 'user') {
      reportMember.mutate(
        { reportedUserId: mission.author.id, ...submission },
        onSettled,
      );
      return;
    }
    reportMission.mutate({ missionId: mission.id, ...submission }, onSettled);
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

  const openCommentActions = (comment: MissionComment) => {
    setActionsFor(comment);
    setCommentSheetMode('actions');
  };

  const closeCommentActions = () => setCommentSheetMode(null);

  const handleStartEditComment = (comment: MissionComment) => {
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
          Mission
        </Heading>
        <BookmarkButton size={18} targetId={missionId} targetType="mission" />
        <Pressable
          accessibilityLabel="Share mission"
          accessibilityRole="button"
          onPress={() => {
            if (!mission) {
              return;
            }
            void Share.share({
              message: `${mission.title}\n\n${mission.description}`,
            });
          }}
        >
          <Icon color="rgb(120,108,94)" name="Share" size={18} />
        </Pressable>
        <Pressable
          accessibilityLabel="More options"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setSheetMode('menu')}
        >
          <Icon color="rgb(120,108,94)" name="ThreeDots" size={18} />
        </Pressable>
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
            ActivitySectionList for why: only comment rows actually on/near
            screen mount as real native views here, no matter how long the
            discussion under a mission grows. The mission card and the
            comments header render once as ListHeaderComponent. */}
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
                      testID="mission-comments-load-more"
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
              {mission && badge ? (
                <VStack className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card">
                  {mission.media && mission.media.length > 0 && (
                    <MediaGallery media={mission.media} />
                  )}

                  <Pressable
                    accessibilityLabel={`Created by ${mission.author.name}`}
                    accessibilityRole="button"
                    className="flex-row items-center gap-2"
                    onPress={() =>
                      openProfile(mission.author.id, mission.author.name)
                    }
                  >
                    <Avatar
                      name={mission.author.name}
                      size="sm"
                      src={mission.author.avatarUrl ?? undefined}
                    />
                    <Text className="text-[13px] text-text-muted">
                      Created by{' '}
                      <Text className="font-inter-semibold text-content">
                        {mission.author.name}
                      </Text>
                    </Text>
                    <AdminBadge isAdmin={mission.author.isAdmin} />
                  </Pressable>

                  <HStack className="items-center gap-3">
                    <View
                      className={`h-11 w-11 items-center justify-center rounded-[14px] ${
                        done ? 'bg-success' : 'bg-accent-subtle'
                      }`}
                    >
                      <Icon
                        color={done ? WHITE : ACCENT}
                        name={done ? 'Check' : missionThemeIcon(mission.theme)}
                        size={20}
                      />
                    </View>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </HStack>

                  <HStack className="items-center gap-1.5">
                    <Heading className="font-inter-bold text-[22px]" size="lg">
                      {mission.title}
                    </Heading>
                    <EditedMark editedAt={mission.editedAt} />
                  </HStack>
                  <Text className="text-[15px] leading-[22px] text-muted-foreground">
                    {mission.description}
                  </Text>

                  {mission.scheduledFor ? (
                    <HStack className="items-center gap-1.5">
                      <Icon
                        color="rgb(120,108,94)"
                        name="CalendarDays"
                        size={16}
                      />
                      <Text className="text-[14px] text-text-muted">
                        {formatDateOnly(mission.scheduledFor)}
                      </Text>
                    </HStack>
                  ) : null}

                  <Divider />

                  <HStack className="items-center gap-2">
                    <HStack className="flex-1 gap-1">
                      {Array.from(
                        { length: mission.stopsTotal },
                        (_, index) => (
                          <View
                            className={`h-[5px] flex-1 rounded-full ${
                              index < mission.stopsDone
                                ? done
                                  ? 'bg-success'
                                  : 'bg-accent'
                                : 'bg-muted'
                            }`}
                            key={index}
                          />
                        ),
                      )}
                    </HStack>
                    <Text className="shrink-0 text-muted-foreground" size="xs">
                      {mission.stopsDone}/{mission.stopsTotal} stops
                    </Text>
                    <Badge
                      leftIcon={<Icon color={AMBER} name="Star" size={11} />}
                      variant="amber"
                    >
                      {mission.xp} XP
                    </Badge>
                  </HStack>

                  <HStack className="items-center gap-3">
                    <HStack className="items-center gap-1">
                      <Icon color="rgb(120,108,94)" name="Users" size={13} />
                      <Text className="text-text-muted" size="xs">
                        {mission.acceptedCount}{' '}
                        {mission.acceptedCount === 1 ? 'person' : 'people'} accepted
                      </Text>
                    </HStack>
                    <HStack className="items-center gap-1">
                      <Icon
                        color="rgb(120,108,94)"
                        name="CheckCircle"
                        size={13}
                      />
                      <Text className="text-text-muted" size="xs">
                        {mission.completedCount} completed
                      </Text>
                    </HStack>
                  </HStack>

                  {mission.status === 'active' &&
                  mission.accepted &&
                  mission.stops[mission.stopsDone] ? (
                    <Text className="text-[13px] text-text-muted">
                      <Text
                        className="font-inter-semibold text-content"
                        size="xs"
                      >
                        Next:{' '}
                      </Text>
                      {mission.stops[mission.stopsDone]}
                    </Text>
                  ) : null}

                  {mission.status === 'active' && !mission.accepted ? (
                    <Button
                      className="self-start rounded-full bg-accent"
                      isDisabled={acceptMission.isPending}
                      onPress={handleAccept}
                      size="sm"
                    >
                      <Icon color={WHITE} name="Favourite" size={15} />
                      <ButtonText className="font-inter-semibold text-accent-foreground">
                        Accept challenge
                      </ButtonText>
                    </Button>
                  ) : null}

                  {mission.status === 'active' && mission.accepted ? (
                    <VStack className="gap-2.5">
                      <Text className="text-[12px] leading-4 text-text-muted">
                        Check in honestly — the adventure is the point.
                      </Text>
                      {checkInPhoto ? (
                        <HStack className="items-center gap-2.5">
                          <Image
                            className="rounded-lg bg-secondary"
                            source={{ uri: checkInPhoto.uri }}
                            style={{ height: 40, width: 40 }}
                          />
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setCheckInPhoto(null)}
                          >
                            <Text className="font-inter-semibold text-[12px] text-text-muted">
                              Remove photo
                            </Text>
                          </Pressable>
                        </HStack>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          className="flex-row items-center gap-1.5 self-start"
                          onPress={() => void handleAttachCheckInPhoto()}
                        >
                          <Icon color="rgb(120,108,94)" name="Add" size={14} />
                          <Text className="font-inter-semibold text-[12px] text-muted-foreground">
                            Add a photo (optional)
                          </Text>
                        </Pressable>
                      )}
                      <Button
                        className="self-start rounded-full bg-accent"
                        isDisabled={checkIn.isPending}
                        onPress={handleCheckIn}
                        size="sm"
                      >
                        <Icon color={WHITE} name="CheckCircle" size={15} />
                        <ButtonText className="font-inter-semibold text-accent-foreground">
                          {isFinalStop ? 'Complete mission' : 'Check in'}
                        </ButtonText>
                      </Button>
                    </VStack>
                  ) : null}

                  <MissionCheckInThumbnailRow
                    missionId={missionId}
                    onOpenAll={() => router.push(`/mission/${missionId}/gallery`)}
                  />

                </VStack>
              ) : missionQuery.isPending ? (
                <View className="items-center py-10">
                  <Spinner size="xlarge" />
                </View>
              ) : (
                <Text className="text-text-muted" size="sm">
                  This mission is no longer available.
                </Text>
              )}

              <Divider />
              <Text className="font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                {commentList.length} comments
              </Text>

              {comments.isPending ? (
                <View className="items-center py-10">
                  <Spinner size="xlarge" />
                </View>
              ) : comments.isError ? (
                <VStack
                  className="items-start gap-2 py-2"
                  testID="mission-comments-error"
                >
                  <Text className="text-text-muted" size="sm">
                    Couldn&apos;t load comments.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    className="rounded-full border border-line px-3 py-2"
                    onPress={() => void comments.refetch()}
                    testID="mission-comments-retry"
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
            void missionQuery.refetch();
            void comments.refetch();
          }}
          refreshing={missionQuery.isRefetching || comments.isRefetching}
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

      {/* Mission options menu / edit -- one Sheet, content switches by mode */}
      <Sheet onClose={() => setSheetMode(null)} visible={sheetMode !== null}>
        {(maxContentHeight) => sheetMode === 'edit' && mission ? (
          <MissionComposer
            initialDescription={mission.description}
            initialTheme={mission.theme}
            initialMedia={mission.media}
            initialScheduledFor={mission.scheduledFor ?? undefined}
            initialStops={mission.stops}
            initialTitle={mission.title}
            initialXp={mission.xp}
            isSubmitting={updateMission.isPending}
            maxContentHeight={maxContentHeight}
            onDismiss={() => setSheetMode(null)}
            onSubmit={(draft) =>
              updateMission.mutate(
                { missionId: mission.id, ...draft },
                {
                  onSuccess: () => {
                    setSheetMode(null);
                    void Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  },
                  onError: () =>
                    showToast("Couldn't save your changes. Try again."),
                },
              )
            }
            submitLabel="Save"
          />
        ) : sheetMode === 'report' ? (
          <ReportSheetContent
            isSubmitting={
              missionReportTarget === 'user'
                ? reportMember.isPending
                : reportMission.isPending
            }
            maxContentHeight={maxContentHeight}
            onSubmit={handleMissionReportSubmit}
            title={
              missionReportTarget === 'user' && mission
                ? `Report ${mission.author.name}`
                : 'Report mission'
            }
          />
        ) : sheetMode === 'confirm-delete' ? (
          <View className="gap-1 px-[18px] pb-4 pt-1">
            <Text className="font-inter-bold text-[17px] text-content">
              Delete this mission?
            </Text>
            <Text className="pb-3 text-text-muted" size="sm">
              This can’t be undone. Everyone’s progress on it will be lost.
            </Text>
            <HStack className="justify-end gap-3">
              <Pressable onPress={() => setSheetMode(null)}>
                <Text className="font-inter-semibold text-[15px] text-content">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={handleDeleteMission}>
                <Text
                  className="font-inter-semibold text-[15px]"
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {isOwnMission ? (
              <>
                <MissionMenuRow
                  icon="Edit"
                  label="Edit mission"
                  onPress={() => setSheetMode('edit')}
                />
                <Divider />
                <MissionMenuRow
                  destructive
                  icon="AlertCircle"
                  label="Delete mission"
                  onPress={() => setSheetMode('confirm-delete')}
                />
              </>
            ) : (
              <>
                <MissionMenuRow
                  icon="EyeOff"
                  label="Block this neighbour"
                  onPress={() => {
                    setSheetMode(null);
                    if (!mission) return;
                    blockUser.mutate(mission.author.id, {
                      onError: () =>
                        showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () =>
                        showToast(`Blocked ${mission.author.name}`),
                    });
                  }}
                />
                <Divider />
                <MissionMenuRow
                  destructive
                  icon="Flag"
                  label="Report this user"
                  onPress={openReportMissionAuthor}
                />
                <Divider />
                <MissionMenuRow
                  destructive
                  icon="AlertCircle"
                  label="Report mission"
                  onPress={openReportMission}
                />
              </>
            )}
          </View>
        )}
      </Sheet>

      {/* Comment actions / delete confirmation -- one Sheet, content switches by mode */}
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
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className="gap-1 px-[18px] pb-2">
            {actionsFor && actionsFor.author.id === userId ? (
              <>
                <MissionMenuRow
                  icon="Edit"
                  label="Edit comment"
                  onPress={() =>
                    actionsFor && handleStartEditComment(actionsFor)
                  }
                />
                <Divider />
                <MissionMenuRow
                  destructive
                  icon="AlertCircle"
                  label="Delete comment"
                  onPress={handleRequestDeleteComment}
                />
              </>
            ) : (
              <>
                <MissionMenuRow
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
                <MissionMenuRow
                  destructive
                  icon="Flag"
                  label="Report this user"
                  onPress={openReportCommentAuthor}
                />
                <Divider />
                <MissionMenuRow
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

      <MissionCelebrationModal
        awardedXp={
          celebration && celebration.leveledUpTo === null
            ? celebration.awardedXp
            : null
        }
        onClose={() => setCelebration(null)}
      />
      <LevelUpCelebrationModal
        newLevel={celebration?.leveledUpTo ?? null}
        onClose={() => setCelebration(null)}
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
