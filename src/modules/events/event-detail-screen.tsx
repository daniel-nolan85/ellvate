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
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { categoryAccent } from '@/src/lib/category-accent';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useSession } from '@/src/platform/session';

import { EventComposer } from './event-composer';
import {
  useCreateEventComment,
  useDeleteEventComment,
  useEventComments,
  useReportEventComment,
  type EventComment,
} from './use-event-comments';
import { useDeleteEvent, useEventsView, useToggleJoin, useUpdateEvent } from './use-events';

interface EventDetailScreenProps {
  readonly eventId: string;
  readonly onBack: () => void;
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

export function EventDetailScreen({ eventId, onBack }: EventDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const userId = session.userId ?? 'demo-user';

  const eventsView = useEventsView();
  const event = useMemo(
    () => eventsView.data?.events.find((entry) => entry.id === eventId),
    [eventsView.data, eventId],
  );
  const isOwnEvent = !!event && event.author.id === userId;

  const toggleJoin = useToggleJoin();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const comments = useEventComments(eventId);
  const createComment = useCreateEventComment(eventId);
  const deleteComment = useDeleteEventComment(eventId);
  const reportComment = useReportEventComment();

  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<EventComment | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
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

  const handleCancelEvent = () => {
    setConfirmCancelOpen(false);
    deleteEvent.mutate(eventId, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBack();
      },
      onError: () => showToast('Couldn’t cancel this event. Try again.'),
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
        {isOwnEvent && (
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
          {event ? (
            <VStack className='gap-3 rounded-[20px] border border-surface-hairline bg-paper p-[18px] shadow-card'>
              {event.media && event.media.length > 0 && (
                <MediaGallery media={event.media} />
              )}

              <Pressable
                accessibilityLabel={`Organised by ${event.author.name}`}
                className='flex-row items-center gap-2'
              >
                <Avatar name={event.author.name} size='sm' src={event.author.avatarUrl ?? undefined} />
                <Text className='text-[13px] text-text-muted'>
                  Organised by{' '}
                  <Text className='font-inter-semibold text-content'>
                    {event.author.name}
                  </Text>
                </Text>
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
              </HStack>
              <HStack className='items-center gap-1.5'>
                <Icon color='rgb(120,108,94)' name='Globe' size={16} />
                <Text className='text-[14px] text-text-muted'>{event.place}</Text>
              </HStack>

              <Divider />

              <HStack className='items-center' space='sm'>
                <HStack>
                  {event.attendees.map((attendee, index) => (
                    <View
                      className={`rounded-full border-2 border-paper ${index > 0 ? '-ml-[9px]' : ''}`}
                      key={attendee.id}
                    >
                      <Avatar name={attendee.name} size='xs' src={attendee.avatarUrl ?? undefined} />
                    </View>
                  ))}
                </HStack>
                <Text className='flex-1 text-text-muted' size='sm'>
                  {event.going} going
                </Text>
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
          ) : eventsView.isPending ? (
            <View className='items-center py-10'>
              <Spinner />
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
            <View className='items-center py-6'>
              <Spinner />
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

      {/* Own-event options menu */}
      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className='gap-1 px-[18px] pb-2'>
          <EventMenuRow
            icon='Edit'
            label='Edit event'
            onPress={() => {
              setMenuOpen(false);
              setIsEditing(true);
            }}
          />
          <Divider />
          <EventMenuRow
            destructive
            icon='AlertCircle'
            label='Cancel event'
            onPress={() => {
              setMenuOpen(false);
              setConfirmCancelOpen(true);
            }}
          />
        </View>
      </Sheet>

      {/* Cancel-event confirmation */}
      <Modal
        animationType='fade'
        onRequestClose={() => setConfirmCancelOpen(false)}
        transparent
        visible={confirmCancelOpen}
      >
        <Pressable
          className='flex-1 items-center justify-center bg-[rgba(0,0,0,0.4)] px-8'
          onPress={() => setConfirmCancelOpen(false)}
        >
          <Pressable
            className='w-full gap-1 rounded-[20px] bg-paper p-5'
            onPress={(pressEvent) => pressEvent.stopPropagation()}
          >
            <Text className='font-inter-bold text-[17px] text-content'>
              Cancel this event?
            </Text>
            <Text className='pb-3 text-text-muted' size='sm'>
              This can’t be undone. Everyone who joined will lose their spot.
            </Text>
            <HStack className='justify-end gap-3'>
              <Pressable onPress={() => setConfirmCancelOpen(false)}>
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
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit event sheet */}
      {event && (
        <Sheet onClose={() => setIsEditing(false)} visible={isEditing}>
          <EventComposer
            initialMedia={event.media}
            initialPlace={event.place}
            initialStartsAt={event.startsAt}
            initialTag={event.tag}
            initialTitle={event.title}
            isSubmitting={updateEvent.isPending}
            onDismiss={() => setIsEditing(false)}
            onSubmit={(eventDraft) =>
              updateEvent.mutate(
                { eventId: event.id, ...eventDraft },
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
            <EventMenuRow
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
            <EventMenuRow
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
