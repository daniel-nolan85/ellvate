import { useState } from 'react';
import {
  Image,
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

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { CommentComposer } from '@/src/components/shared/comment-composer';
import { CommentItem } from '@/src/components/shared/comment-item';
import { EditedMark } from '@/src/components/shared/edited-mark';
import { MediaGallery } from '@/src/components/shared/media-gallery';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Avatar } from '@/src/components/ui/avatar';
import { Badge, type BadgeVariant } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { ConfirmModal } from '@/src/components/ui/confirm-modal';
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
import { useOpenProfile } from '@/src/modules/profile';
import { pickGalleryImages, type PickedImage } from '@/src/platform/media-picker';
import { useSession } from '@/src/platform/session';

import { LevelUpCelebrationModal } from './level-up-celebration-modal';
import { MissionCelebrationModal } from './mission-celebration-modal';
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
  useMissionCheckIns,
  useReportCheckIn,
  useUpdateMission,
  type CheckInCelebration,
  type CheckInEntry,
  type MissionStatus,
} from './use-missions';

interface MissionDetailScreenProps {
  readonly missionId: string;
  readonly onBack: () => void;
}

const ACCENT = 'rgb(181,80,44)';
const AMBER = 'rgb(217,123,41)';
const WHITE = 'rgb(255,255,255)';

const STATUS_BADGE: Readonly<Record<
  MissionStatus,
  { readonly variant: BadgeVariant; readonly label: string }
>> = {
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

export function MissionDetailScreen({ missionId, onBack }: MissionDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const [celebration, setCelebration] = useState<CheckInCelebration | null>(null);

  const missionQuery = useMission(missionId);
  const acceptMission = useAcceptMission();
  const checkIn = useCheckIn(setCelebration);
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const comments = useMissionComments(missionId);
  const createComment = useCreateMissionComment(missionId);
  const updateComment = useUpdateMissionComment(missionId);
  const deleteComment = useDeleteMissionComment(missionId);
  const reportComment = useReportMissionComment();
  const checkIns = useMissionCheckIns(missionId);
  const reportCheckIn = useReportCheckIn();

  const [checkInPhoto, setCheckInPhoto] = useState<PickedImage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<MissionComment | null>(null);
  const [actionsFor, setActionsFor] = useState<MissionComment | null>(null);
  const [actionsSheetOpen, setActionsSheetOpen] = useState(false);
  const [commentPendingDelete, setCommentPendingDelete] =
    useState<MissionComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedCheckIn, setExpandedCheckIn] = useState<CheckInEntry | null>(null);
  const [reportTarget, setReportTarget] = useState<CheckInEntry | null>(null);

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

  const handleAttachPhoto = async () => {
    const [picked] = await pickGalleryImages({ selectionLimit: 1 });
    if (picked) {
      setCheckInPhoto(picked);
    }
  };

  const handleCheckIn = () => {
    if (!mission) {
      return;
    }
    if (isFinalStop && !checkInPhoto) {
      void handleAttachPhoto();
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
        onSuccess: () => setCheckInPhoto(null),
        onError: () => showToast('Couldn’t check in. Try again.'),
      },
    );
  };

  const handleDeleteMission = () => {
    if (!mission) {
      return;
    }
    setConfirmDeleteOpen(false);
    deleteMission.mutate(mission.id, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBack();
      },
      onError: () => showToast('Couldn’t delete this mission. Try again.'),
    });
  };

  const handleConfirmReportCheckIn = () => {
    const target = reportTarget;
    setReportTarget(null);
    if (!target) {
      return;
    }
    reportCheckIn.mutate(target.id, {
      onError: () => showToast('Couldn’t report this check-in. Try again.'),
      onSuccess: () => showToast('Thanks — our moderators will take a look.'),
    });
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
    setActionsSheetOpen(true);
  };

  const closeCommentActions = () => setActionsSheetOpen(false);

  const handleStartEditComment = (comment: MissionComment) => {
    setActionsSheetOpen(false);
    setReplyTo(null);
    setEditingComment(comment);
    setDraft(comment.body);
  };

  const handleCancelEditComment = () => {
    setEditingComment(null);
    setDraft('');
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

  const commentList = comments.data?.pages.flatMap((page) => page.comments) ?? [];
  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: comments.fetchNextPage,
      hasNextPage: comments.hasNextPage,
      isFetchingNextPage: comments.isFetchingNextPage,
    },
  ]);

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
          Mission
        </Heading>
        <BookmarkButton size={18} targetId={missionId} targetType='mission' />
        <Pressable
          accessibilityLabel='Share mission'
          accessibilityRole='button'
          onPress={() => {
            if (!mission) {
              return;
            }
            void Share.share({
              message: `${mission.title}\n\n${mission.description}`,
            });
          }}
        >
          <Icon color='rgb(120,108,94)' name='Share' size={18} />
        </Pressable>
        {isOwnMission && (
          <Pressable
            accessibilityLabel='More options'
            accessibilityRole='button'
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
          >
            <Icon color='rgb(120,108,94)' name='ThreeDots' size={18} />
          </Pressable>
        )}
      </HStack>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className='flex-1'
      >
        <ScrollView
          className='flex-1'
          contentContainerClassName='gap-4 px-[18px] py-4'
          onScroll={onScroll}
          scrollEventThrottle={100}
        >
        {mission && badge ? (
          <VStack className='gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
            {mission.media && mission.media.length > 0 && (
              <MediaGallery media={mission.media} />
            )}

            <Pressable
              accessibilityLabel={`Created by ${mission.author.name}`}
              accessibilityRole='button'
              className='flex-row items-center gap-2'
              onPress={() => openProfile(mission.author.id, mission.author.name)}
            >
              <Avatar
                name={mission.author.name}
                size='sm'
                src={mission.author.avatarUrl ?? undefined}
              />
              <Text className='text-[13px] text-text-muted'>
                Created by{' '}
                <Text className='font-inter-semibold text-content'>
                  {mission.author.name}
                </Text>
              </Text>
            </Pressable>

            <HStack className='items-center gap-3'>
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

            <HStack className='items-center gap-1.5'>
              <Heading className='font-inter-bold text-[22px]' size='lg'>
                {mission.title}
              </Heading>
              <EditedMark editedAt={mission.editedAt} />
            </HStack>
            <Text className='text-[15px] leading-[22px] text-muted-foreground'>
              {mission.description}
            </Text>

            {mission.scheduledFor ? (
              <HStack className='items-center gap-1.5'>
                <Icon color='rgb(120,108,94)' name='CalendarDays' size={16} />
                <Text className='text-[14px] text-text-muted'>
                  {formatDateOnly(mission.scheduledFor)}
                </Text>
              </HStack>
            ) : null}

            <Divider />

            <HStack className='items-center gap-2'>
              <HStack className='flex-1 gap-1'>
                {Array.from({ length: mission.stopsTotal }, (_, index) => (
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
                ))}
              </HStack>
              <Text className='shrink-0 text-muted-foreground' size='xs'>
                {mission.stopsDone}/{mission.stopsTotal} stops
              </Text>
              <Badge leftIcon={<Icon color={AMBER} name='Star' size={11} />} variant='amber'>
                {mission.xp} XP
              </Badge>
            </HStack>

            {mission.status === 'active' && mission.accepted && mission.stops[mission.stopsDone] ? (
              <Text className='text-[13px] text-text-muted'>
                <Text className='font-inter-semibold text-content' size='xs'>
                  Next:{' '}
                </Text>
                {mission.stops[mission.stopsDone]}
              </Text>
            ) : null}

            {mission.status === 'active' && !mission.accepted ? (
              <Button
                className='self-start rounded-full bg-accent'
                isDisabled={acceptMission.isPending}
                onPress={handleAccept}
                size='sm'
              >
                <Icon color={WHITE} name='Favourite' size={15} />
                <ButtonText className='font-inter-semibold text-accent-foreground'>
                  Accept challenge
                </ButtonText>
              </Button>
            ) : null}

            {mission.status === 'active' && mission.accepted ? (
              <VStack className='gap-2.5'>
                {checkInPhoto ? (
                  <HStack className='items-center gap-2.5'>
                    <Image
                      source={{ uri: checkInPhoto.uri }}
                      style={{ borderRadius: 10, height: 44, width: 44 }}
                    />
                    <Text className='flex-1 text-text-muted' size='xs'>
                      Photo attached
                    </Text>
                    <Pressable
                      accessibilityLabel='Remove photo'
                      accessibilityRole='button'
                      hitSlop={8}
                      onPress={() => setCheckInPhoto(null)}
                    >
                      <Icon color='rgb(120,108,94)' name='Close' size={16} />
                    </Pressable>
                  </HStack>
                ) : null}
                <HStack className='items-center gap-2.5'>
                  <Button
                    className='self-start rounded-full bg-accent'
                    isDisabled={checkIn.isPending}
                    onPress={handleCheckIn}
                    size='sm'
                  >
                    <Icon color={WHITE} name='CheckCircle' size={15} />
                    <ButtonText className='font-inter-semibold text-accent-foreground'>
                      {isFinalStop
                        ? checkInPhoto
                          ? 'Finish mission'
                          : 'Add photo to finish'
                        : 'Check in'}
                    </ButtonText>
                  </Button>
                  {!isFinalStop && !checkInPhoto ? (
                    <Pressable
                      accessibilityLabel='Attach a photo (optional)'
                      accessibilityRole='button'
                      className='h-9 w-9 items-center justify-center rounded-full bg-accent-subtle'
                      hitSlop={8}
                      onPress={() => void handleAttachPhoto()}
                    >
                      <Icon color={ACCENT} name='Image' size={16} />
                    </Pressable>
                  ) : null}
                </HStack>
              </VStack>
            ) : null}

            {checkIns.data && checkIns.data.some((entry) => entry.photoUrl) ? (
              <>
                <Divider />
                <VStack className='gap-3'>
                  <Text className='font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground'>
                    Check-in photos
                  </Text>
                  {checkIns.data
                    .filter((entry) => entry.photoUrl)
                    .map((entry) => (
                      <HStack className='items-center gap-2.5' key={entry.id}>
                        <Pressable
                          accessibilityLabel={`View ${entry.user.name}'s check-in photo`}
                          accessibilityRole='button'
                          onPress={() => setExpandedCheckIn(entry)}
                        >
                          <Image
                            source={{ uri: entry.photoUrl ?? '' }}
                            style={{ borderRadius: 10, height: 44, width: 44 }}
                          />
                        </Pressable>
                        <VStack className='flex-1 gap-0.5'>
                          <Text className='font-inter-semibold text-[13px] text-content'>
                            {entry.user.name}
                          </Text>
                          <Text className='text-text-muted' size='xs'>
                            Stop {entry.stopIndex + 1}
                          </Text>
                        </VStack>
                        <Pressable
                          accessibilityLabel='Report check-in'
                          accessibilityRole='button'
                          hitSlop={8}
                          onPress={() => setReportTarget(entry)}
                        >
                          <Icon color='rgb(120,108,94)' name='Flag' size={16} />
                        </Pressable>
                      </HStack>
                    ))}
                </VStack>
              </>
            ) : null}
          </VStack>
        ) : missionQuery.isPending ? (
          <View className='items-center py-10'>
            <Spinner size='xlarge' />
          </View>
        ) : (
          <Text className='text-text-muted' size='sm'>
            This mission is no longer available.
          </Text>
        )}

        <Divider />
        <Text className='font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground'>
          {commentList.length} comments
        </Text>

        {comments.isPending ? (
          <View className='items-center py-10'>
            <Spinner size='xlarge' />
          </View>
        ) : comments.isError ? (
          <VStack className='items-start gap-2 py-2' testID='mission-comments-error'>
            <Text className='text-text-muted' size='sm'>
              Couldn&apos;t load comments.
            </Text>
            <Pressable
              accessibilityRole='button'
              className='rounded-full border border-line px-3 py-2'
              onPress={() => void comments.refetch()}
              testID='mission-comments-retry'
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
                onActions={openCommentActions}
                onOpenAuthor={(authorId) =>
                  openProfile(authorId, comment.author.name)
                }
                onReply={handleReply}
              />
            ))}
            {comments.hasNextPage ? (
              comments.isFetchingNextPage ? (
                <View className='items-center py-3' testID='mission-comments-load-more'>
                  <Spinner size='small' />
                </View>
              ) : null
            ) : (
              <AllCaughtUp />
            )}
          </VStack>
        )}
        </ScrollView>

        <CommentComposer
          editing={editingComment !== null}
          isSending={editingComment ? updateComment.isPending : createComment.isPending}
          onCancelEdit={handleCancelEditComment}
          onChangeText={setDraft}
          onClearReply={() => setReplyTo(null)}
          onSend={handleSend}
          replyTo={replyTo}
          value={draft}
        />
      </KeyboardAvoidingView>

      {/* Own-mission options menu */}
      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className='gap-1 px-[18px] pb-2'>
          <MissionMenuRow
            icon='Edit'
            label='Edit mission'
            onPress={() => {
              setMenuOpen(false);
              setIsEditing(true);
            }}
          />
          <Divider />
          <MissionMenuRow
            destructive
            icon='AlertCircle'
            label='Delete mission'
            onPress={() => {
              setMenuOpen(false);
              setConfirmDeleteOpen(true);
            }}
          />
        </View>
      </Sheet>

      {/* Delete confirmation */}
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
              Delete this mission?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone. Everyone’s progress on it will be lost.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setConfirmDeleteOpen(false)}>
                <Text className='font-inter-semibold text-[15px] text-content'>
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={handleDeleteMission}>
                <Text
                  className='font-inter-semibold text-[15px]'
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit mission sheet */}
      {mission && (
        <Sheet onClose={() => setIsEditing(false)} visible={isEditing}>
          <MissionComposer
            initialDescription={mission.description}
            initialTheme={mission.theme}
            initialMedia={mission.media}
            initialScheduledFor={mission.scheduledFor ?? undefined}
            initialStops={mission.stops}
            initialTitle={mission.title}
            initialXp={mission.xp}
            isSubmitting={updateMission.isPending}
            onDismiss={() => setIsEditing(false)}
            onSubmit={(draft) =>
              updateMission.mutate(
                { missionId: mission.id, ...draft },
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
            submitLabel='Save'
          />
        </Sheet>
      )}

      {/* Comment actions */}
      <Modal
        animationType='fade'
        onRequestClose={closeCommentActions}
        transparent
        visible={actionsSheetOpen}
      >
        <Pressable
          className='flex-1 bg-[rgba(0,0,0,0.4)]'
          onPress={closeCommentActions}
        />
        <View
          className='absolute bottom-0 left-0 right-0 gap-1 rounded-t-[20px] bg-paper px-[18px] pt-2.5'
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className='mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-line' />
          {actionsFor && actionsFor.author.id === userId ? (
            <>
              <MissionMenuRow
                icon='Edit'
                label='Edit comment'
                onPress={() => actionsFor && handleStartEditComment(actionsFor)}
              />
              <Divider />
              <MissionMenuRow
                destructive
                icon='AlertCircle'
                label='Delete comment'
                onPress={handleRequestDeleteComment}
              />
            </>
          ) : (
            <MissionMenuRow
              destructive
              icon='AlertCircle'
              label='Report comment'
              onPress={() => {
                const target = actionsFor;
                closeCommentActions();
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

      {/* Delete-comment confirmation */}
      <Modal
        animationType='fade'
        onRequestClose={() => setCommentPendingDelete(null)}
        transparent
        visible={commentPendingDelete !== null}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8'
          onPress={() => setCommentPendingDelete(null)}
        >
          <Pressable
            className='w-full gap-1 rounded-[20px] bg-paper p-5'
            onPress={(event) => event.stopPropagation()}
          >
            <Text className='font-inter-bold text-[17px] text-content'>
              Delete comment?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setCommentPendingDelete(null)}>
                <Text className='font-inter-semibold text-[15px] text-content'>
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDeleteComment}>
                <Text
                  className='font-inter-semibold text-[15px]'
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Delete
                </Text>
              </Pressable>
            </HStack>
          </Pressable>
        </Pressable>
      </Modal>

      <MissionCelebrationModal
        awardedXp={celebration && celebration.leveledUpTo === null ? celebration.awardedXp : null}
        onClose={() => setCelebration(null)}
      />
      <LevelUpCelebrationModal
        newLevel={celebration?.leveledUpTo ?? null}
        onClose={() => setCelebration(null)}
      />

      {/* Full-size check-in photo viewer */}
      <Modal
        animationType='fade'
        onRequestClose={() => setExpandedCheckIn(null)}
        transparent
        visible={expandedCheckIn !== null}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.85)] px-4'
          onPress={() => setExpandedCheckIn(null)}
        >
          {expandedCheckIn ? (
            <VStack className='w-full items-center gap-3'>
              <Image
                resizeMode='contain'
                source={{ uri: expandedCheckIn.photoUrl ?? '' }}
                style={{ aspectRatio: 1, borderRadius: 12, width: '100%' }}
              />
              <Text className='text-[13px]' style={{ color: 'rgb(255,255,255)' }}>
                {expandedCheckIn.user.name} · Stop {expandedCheckIn.stopIndex + 1}
              </Text>
            </VStack>
          ) : null}
        </Pressable>
      </Modal>

      <ConfirmModal
        cancelLabel='Cancel'
        confirmLabel='Report'
        destructive
        message="Let our moderators know this check-in photo looks fake or doesn't match the mission."
        onClose={() => setReportTarget(null)}
        onConfirm={handleConfirmReportCheckIn}
        title='Report this photo?'
        visible={reportTarget !== null}
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
