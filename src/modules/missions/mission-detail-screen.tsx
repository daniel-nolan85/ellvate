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
import { useSession } from '@/src/platform/session';

import { MissionComposer } from './mission-composer';
import {
  useCreateMissionComment,
  useDeleteMissionComment,
  useMissionComments,
  useReportMissionComment,
  type MissionComment,
} from './use-mission-comments';
import {
  useCheckIn,
  useDeleteMission,
  useMissionsView,
  useUpdateMission,
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
  locked: { label: 'Locked', variant: 'muted' },
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

  const missionsView = useMissionsView();
  const checkIn = useCheckIn();
  const updateMission = useUpdateMission();
  const deleteMission = useDeleteMission();
  const comments = useMissionComments(missionId);
  const createComment = useCreateMissionComment(missionId);
  const deleteComment = useDeleteMissionComment(missionId);
  const reportComment = useReportMissionComment();

  const [awardedXp, setAwardedXp] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<MissionComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const mission = useMemo(
    () => missionsView.data?.missions.find((entry) => entry.id === missionId),
    [missionsView.data, missionId],
  );
  const isOwnMission = !!mission && mission.author.id === userId;

  const done = mission?.status === 'done';
  const locked = mission?.status === 'locked';
  const badge = mission ? STATUS_BADGE[mission.status] : null;

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleCheckIn = () => {
    if (!mission) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    checkIn.mutate(mission.id, {
      onSuccess: (result) => {
        if (result.awardedXp > 0) {
          setAwardedXp(result.awardedXp);
        }
      },
    });
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
        <ScrollView className='flex-1' contentContainerClassName='gap-4 px-[18px] py-4'>
        {mission && badge ? (
          <VStack className='gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
            {mission.media && mission.media.length > 0 && (
              <MediaGallery media={mission.media} />
            )}

            <HStack className='items-center gap-2'>
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
            </HStack>

            <HStack className='items-center gap-3'>
              <View
                className={`h-11 w-11 items-center justify-center rounded-[14px] ${
                  done ? 'bg-success' : 'bg-accent-subtle'
                }`}
              >
                <Icon
                  color={done ? WHITE : ACCENT}
                  name={locked ? 'Lock' : done ? 'Check' : mission.icon}
                  size={20}
                />
              </View>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </HStack>

            <Heading className='font-inter-bold text-[22px]' size='lg'>
              {mission.title}
            </Heading>
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

            {mission.status === 'active' && awardedXp === null ? (
              <Button
                className='self-start rounded-full bg-accent'
                isDisabled={checkIn.isPending}
                onPress={handleCheckIn}
                size='sm'
              >
                <Icon color={WHITE} name='CheckCircle' size={15} />
                <ButtonText className='font-inter-semibold text-accent-foreground'>
                  Check in
                </ButtonText>
              </Button>
            ) : null}
            {awardedXp !== null ? (
              <Text className='font-inter-bold text-success' size='xs'>
                Nice — +{awardedXp} XP
              </Text>
            ) : null}
          </VStack>
        ) : missionsView.isPending ? (
          <View className='items-center py-10'>
            <Spinner />
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
          <View className='items-center py-6'>
            <Spinner />
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
                onActions={setActionsFor}
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
            initialIcon={mission.icon}
            initialMedia={mission.media}
            initialScheduledFor={mission.scheduledFor ?? undefined}
            initialStopsTotal={mission.stopsTotal}
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
          {actionsFor && actionsFor.author.id === userId ? (
            <MissionMenuRow
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
            <MissionMenuRow
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
