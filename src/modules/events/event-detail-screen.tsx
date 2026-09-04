import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
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
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useBlockUser, useOpenProfile } from '@/src/modules/profile';
import { useSession } from '@/src/platform/session';

import { EventComposer } from './event-composer';
import {
  useCreateEventComment,
  useDeleteEventComment,
  useEventComments,
  useReportEventComment,
  useUpdateEventComment,
  type EventComment,
} from './use-event-comments';
import {
  useDeleteEvent,
  useEvent,
  useEventAttendees,
  useReportEvent,
  useToggleJoin,
  useUpdateEvent,
} from './use-events';

interface EventDetailScreenProps {
  readonly eventId: string;
  readonly onBack: () => void;
  // True when reached from Notifications (see app/notification/event/[id].tsx)
  // -- see petition-detail-screen.tsx's identical prop for why.
  readonly modal?: boolean;
}

const formatDayLabel = (dayLabel: string) =>
  dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).toLowerCase();

function EventMenuRow({
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

export function EventDetailScreen({
  eventId,
  modal = false,
  onBack,
}: EventDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';
  const openProfile = useOpenProfile();

  const eventQuery = useEvent(eventId);
  const event = eventQuery.data?.event;
  const isOwnEvent = !!event && event.author.id === userId;

  const toggleJoin = useToggleJoin();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const blockUser = useBlockUser();
  const reportEvent = useReportEvent();

  const comments = useEventComments(eventId);
  const createComment = useCreateEventComment(eventId);
  const updateComment = useUpdateEventComment(eventId);
  const deleteComment = useDeleteEventComment(eventId);
  const reportComment = useReportEventComment();

  // A single Sheet whose content switches by mode, rather than separate
  // Sheet/Modal instances -- closing one and opening another in the same
  // tick briefly presents two native Modals at once (a Sheet stays mounted,
  // rendering its own full-screen Modal, until its close animation
  // finishes), which corrupts UIKit's presentation stack and can leave the
  // screen permanently unresponsive. Applies to both the event's own
  // menu/edit/cancel-confirm flow and the comment actions/delete-confirm flow.
  const [sheetMode, setSheetMode] = useState<
    'menu' | 'edit' | 'confirm-cancel' | null
  >(null);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<EventComment | null>(null);
  const [actionsFor, setActionsFor] = useState<EventComment | null>(null);
  const [commentSheetMode, setCommentSheetMode] = useState<
    'actions' | 'confirm-delete' | null
  >(null);
  const [toast, setToast] = useState<string | null>(null);

  const attendees = useEventAttendees(eventId, attendeesOpen);
  const attendeeList = attendees.data?.pages.flatMap((page) => page.attendees) ?? [];
  const onAttendeesScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: attendees.fetchNextPage,
      hasNextPage: attendees.hasNextPage,
      isFetchingNextPage: attendees.isFetchingNextPage,
    },
  ]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
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

  const openCommentActions = (comment: EventComment) => {
    setActionsFor(comment);
    setCommentSheetMode('actions');
  };

  const closeCommentActions = () => setCommentSheetMode(null);

  const handleStartEditComment = (comment: EventComment) => {
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

  const handleCancelEvent = () => {
    setSheetMode(null);
    deleteEvent.mutate(eventId, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBack();
      },
      onError: () => showToast('Couldn’t cancel this event. Try again.'),
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
        className={`items-center gap-2 px-[18px] pb-3 ${modal ? '' : 'border-b border-line'}`}
        collapsable={false}
        style={{ paddingTop: modal ? 24 : insets.top + 8 }}
      >
        {modal ? null : (
          <Pressable accessibilityLabel='Back' onPress={onBack}>
            <Icon name='ChevronLeft' size={22} />
          </Pressable>
        )}
        <Heading className='flex-1 font-inter-bold text-[16px]' size='sm'>
          Event
        </Heading>
        <BookmarkButton size={18} targetId={eventId} targetType='event' />
        <Pressable
          accessibilityLabel='Share event'
          accessibilityRole='button'
          onPress={() => {
            if (!event) {
              return;
            }
            void Share.share({
              message: `${event.title}\n\n${formatDayLabel(event.dayLabel)} ${event.dateLabel} · ${event.timeLabel}\n${event.place}`,
            });
          }}
        >
          <Icon color='rgb(120,108,94)' name='Share' size={18} />
        </Pressable>
        <Pressable
          accessibilityLabel='More options'
          accessibilityRole='button'
          hitSlop={8}
          onPress={() => setSheetMode('menu')}
        >
          <Icon color='rgb(120,108,94)' name='ThreeDots' size={18} />
        </Pressable>
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
          {event ? (
            <VStack className='gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
              {event.media && event.media.length > 0 && (
                <MediaGallery media={event.media} />
              )}

              <Pressable
                accessibilityLabel={`Organised by ${event.author.name}`}
                accessibilityRole='button'
                className='flex-row items-center gap-2'
                onPress={() => openProfile(event.author.id, event.author.name)}
              >
                <Avatar name={event.author.name} size='sm' src={event.author.avatarUrl ?? undefined} />
                <Text className='text-[13px] text-text-muted'>
                  Organised by{' '}
                  <Text className='font-inter-semibold text-content'>
                    {event.author.name}
                  </Text>
                </Text>
                <AdminBadge isAdmin={event.author.isAdmin} />
              </Pressable>

              <HStack className='items-center' space='xs'>
                <Badge variant={categoryAccent(event.tag)}>{event.tag}</Badge>
                {event.featured ? <Badge variant='amber'>Featured</Badge> : null}
              </HStack>

              <Heading className='font-inter-bold text-[22px]' size='lg'>
                {event.title}
              </Heading>

              <HStack className='items-center gap-1.5'>
                <Icon color='rgb(120,108,94)' name='Clock' size={16} />
                <Text className='text-[14px] text-text-muted'>
                  {formatDayLabel(event.dayLabel)} {event.dateLabel} · {event.timeLabel}
                </Text>
                <EditedMark editedAt={event.editedAt} />
              </HStack>
              <HStack className='items-center gap-1.5'>
                <Icon color='rgb(120,108,94)' name='Globe' size={16} />
                <Text className='text-[14px] text-text-muted'>{event.place}</Text>
              </HStack>

              <Divider />

              <HStack className='items-center' space='sm'>
                <HStack>
                  {event.attendees.map((attendee, index) => (
                    <Pressable
                      accessibilityLabel={`Open ${attendee.name}'s profile`}
                      accessibilityRole='button'
                      className={`rounded-full border-2 border-paper ${index > 0 ? '-ml-[9px]' : ''}`}
                      key={attendee.id}
                      onPress={() => openProfile(attendee.id, attendee.name)}
                    >
                      <Avatar name={attendee.name} size='xs' src={attendee.avatarUrl ?? undefined} />
                    </Pressable>
                  ))}
                </HStack>
                <Pressable
                  accessibilityLabel={`See everyone going — ${event.going} people`}
                  accessibilityRole='button'
                  className='flex-1'
                  onPress={() => setAttendeesOpen(true)}
                >
                  <Text className='text-text-muted underline' size='sm'>
                    {event.going} going
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole='button'
                  className={`rounded-full px-5 py-2.5 ${
                    event.joined ? 'bg-success' : 'bg-accent'
                  }`}
                  onPress={() => toggleJoin.mutate(event.id)}
                >
                  <Text className='font-inter-semibold text-[13px] text-accent-foreground'>
                    {event.joined ? 'Going ✓' : 'Join event'}
                  </Text>
                </Pressable>
              </HStack>
            </VStack>
          ) : eventQuery.isPending ? (
            <View className='items-center py-10'>
              <Spinner size='xlarge' />
            </View>
          ) : (
            <Text className='text-text-muted' size='sm'>
              This event is no longer available.
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
            <VStack className='items-start gap-2 py-2' testID='event-comments-error'>
              <Text className='text-text-muted' size='sm'>
                Couldn&apos;t load comments.
              </Text>
              <Pressable
                accessibilityRole='button'
                className='rounded-full border border-line px-3 py-2'
                onPress={() => void comments.refetch()}
                testID='event-comments-retry'
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
                  <View className='items-center py-3' testID='event-comments-load-more'>
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

      {/* Event options menu / edit -- one Sheet, content switches by mode */}
      <Sheet onClose={() => setSheetMode(null)} visible={sheetMode !== null}>
        {sheetMode === 'edit' && event ? (
          <EventComposer
            initialMedia={event.media}
            initialPlace={event.place}
            initialStartsAt={event.startsAt}
            initialTag={event.tag}
            initialTitle={event.title}
            isSubmitting={updateEvent.isPending}
            onDismiss={() => setSheetMode(null)}
            onSubmit={(eventDraft) =>
              updateEvent.mutate(
                { eventId: event.id, ...eventDraft },
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
            submitLabel='Save'
          />
        ) : sheetMode === 'confirm-cancel' ? (
          <View className='gap-1 px-[18px] pb-4 pt-1'>
            <Text className='font-inter-bold text-[17px] text-content'>
              Cancel this event?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone. Everyone who joined will lose their spot.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setSheetMode(null)}>
                <Text className='font-inter-semibold text-[15px] text-content'>
                  Keep event
                </Text>
              </Pressable>
              <Pressable onPress={handleCancelEvent}>
                <Text
                  className='font-inter-semibold text-[15px]'
                  style={{ color: 'rgb(231,0,11)' }}
                >
                  Cancel event
                </Text>
              </Pressable>
            </HStack>
          </View>
        ) : (
          <View className='gap-1 px-[18px] pb-2'>
            {isOwnEvent ? (
              <>
                <EventMenuRow
                  icon='Edit'
                  label='Edit event'
                  onPress={() => setSheetMode('edit')}
                />
                <Divider />
                <EventMenuRow
                  destructive
                  icon='AlertCircle'
                  label='Cancel event'
                  onPress={() => setSheetMode('confirm-cancel')}
                />
              </>
            ) : (
              <>
                <EventMenuRow
                  icon='EyeOff'
                  label='Block this neighbour'
                  onPress={() => {
                    setSheetMode(null);
                    if (!event) return;
                    blockUser.mutate(event.author.id, {
                      onError: () => showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () => showToast(`Blocked ${event.author.name}`),
                    });
                  }}
                />
                <Divider />
                <EventMenuRow
                  destructive
                  icon='AlertCircle'
                  label='Report event'
                  onPress={() => {
                    setSheetMode(null);
                    if (!event) return;
                    reportEvent.mutate(event.id, {
                      onError: () => showToast('Couldn’t report this event. Try again.'),
                      onSuccess: () => showToast('Thanks — our moderators will take a look.'),
                    });
                  }}
                />
              </>
            )}
          </View>
        )}
      </Sheet>

      {/* Attendee list */}
      <Sheet onClose={() => setAttendeesOpen(false)} visible={attendeesOpen}>
        <VStack className='gap-1 px-[18px] pb-4' space='xs'>
          <Text className='pb-2 font-inter-bold text-[17px] text-content'>
            {event?.going ?? 0} going
          </Text>
          {attendees.isPending ? (
            <View className='items-center py-8'>
              <Spinner />
            </View>
          ) : attendeeList.length > 0 ? (
            <ScrollView
              contentContainerClassName='gap-1'
              onScroll={onAttendeesScroll}
              scrollEventThrottle={100}
              style={{ maxHeight: 420 }}
            >
              {attendeeList.map((attendee) => (
                <Pressable
                  accessibilityLabel={`Open ${attendee.name}'s profile`}
                  accessibilityRole='button'
                  className='flex-row items-center gap-3 py-2.5'
                  key={attendee.id}
                  onPress={() => {
                    setAttendeesOpen(false);
                    openProfile(attendee.id, attendee.name);
                  }}
                >
                  <Avatar name={attendee.name} size='sm' src={attendee.avatarUrl ?? undefined} />
                  <Text className='font-inter-medium text-[14px] text-content'>
                    {attendee.name}
                  </Text>
                </Pressable>
              ))}
              {attendees.isFetchingNextPage && (
                <View className='items-center py-3' testID='attendees-load-more'>
                  <Spinner size='small' />
                </View>
              )}
            </ScrollView>
          ) : (
            <Text className='py-2 text-text-muted' size='sm'>
              No one has joined yet.
            </Text>
          )}
        </VStack>
      </Sheet>

      {/* Comment actions / delete confirmation -- one Sheet, content switches by mode */}
      <Sheet onClose={closeCommentActions} visible={commentSheetMode !== null}>
        {commentSheetMode === 'confirm-delete' ? (
          <View className='gap-1 px-[18px] pb-4 pt-1'>
            <Text className='font-inter-bold text-[17px] text-content'>
              Delete comment?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setCommentSheetMode(null)}>
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
          </View>
        ) : (
          <View className='gap-1 px-[18px] pb-2'>
            {actionsFor && actionsFor.author.id === userId ? (
              <>
                <EventMenuRow
                  icon='Edit'
                  label='Edit comment'
                  onPress={() => actionsFor && handleStartEditComment(actionsFor)}
                />
                <Divider />
                <EventMenuRow
                  destructive
                  icon='AlertCircle'
                  label='Delete comment'
                  onPress={handleRequestDeleteComment}
                />
              </>
            ) : (
              <>
                <EventMenuRow
                  icon='EyeOff'
                  label='Block this neighbour'
                  onPress={() => {
                    const target = actionsFor;
                    closeCommentActions();
                    if (!target) return;
                    blockUser.mutate(target.author.id, {
                      onError: () =>
                        showToast('Couldn’t block this neighbour. Try again.'),
                      onSuccess: () => showToast(`Blocked ${target.author.name}`),
                    });
                  }}
                />
                <Divider />
                <EventMenuRow
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
              </>
            )}
          </View>
        )}
      </Sheet>

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
