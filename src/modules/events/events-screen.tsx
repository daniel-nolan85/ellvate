import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { EmptyState } from '@/src/components/shared/empty-state';
import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { EventComposer } from './event-composer';
import { EventRow } from './event-row';
import { EventsCalendar } from './events-calendar';
import type { CommunityEvent } from './events-types';
import { FeaturedEventCard } from './featured-event-card';
import {
  useCreateEvent,
  useEventDates,
  useEventsView,
  useToggleJoin,
} from './use-events';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center py-3" testID="events-load-more">
      <Spinner size="small" />
    </View>
  );
}

function CreateButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button
      className="rounded-full bg-accent px-4"
      onPress={onPress}
      size="sm"
      testID="events-add"
    >
      <Icon color={COLOR_ACCENT_FOREGROUND} name="Add" size={14} />
      <ButtonText className="font-inter-semibold text-[13px] text-accent-foreground">
        Create
      </ButtonText>
    </Button>
  );
}

interface EventsScreenProps {
  readonly onOpenEvent?: (eventId: string) => void;
}

export function EventsScreen({ onOpenEvent }: EventsScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dates = useEventDates();
  const eventsView = useEventsView(selectedDate);
  const toggleJoin = useToggleJoin();
  const createEvent = useCreateEvent();
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const events = eventsView.data?.pages.flatMap((page) => page.events) ?? [];
  // Sorted featured-first server-side, so the very first item (if featured)
  // is always the one to pull out for the hero card.
  const featured = events[0]?.featured ? events[0] : undefined;
  const rest = featured ? events.slice(1) : events;
  const restToRender: readonly CommunityEvent[] =
    eventsView.isPending || eventsView.isError ? [] : rest;

  const handleToggleJoin = (eventId: string) => {
    toggleJoin.mutate(eventId);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <View className="flex-1">
      {/* FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
          ActivitySectionList for why: this screen pairs a calendar widget
          (EventsCalendar) with a growing list, the same shape that caused
          My Activity's "All" filter pills to corrupt under enough
          simultaneous content. Only rows actually on/near screen mount as
          real native views here, no matter how many events load. */}
      <FlatList
        className="flex-1 bg-canvas"
        contentContainerStyle={{ paddingBottom: 130 }}
        data={restToRender}
        keyExtractor={(event) => event.id}
        ListEmptyComponent={
          eventsView.isPending ? (
            <Box className="items-center justify-center py-24">
              <Spinner size="xlarge" />
            </Box>
          ) : eventsView.isError ? (
            <VStack className="items-center px-5 py-24" space="md">
              <Text className="text-muted-foreground" size="sm">
                Could not load events.
              </Text>
              <Button
                action="secondary"
                onPress={() => void eventsView.refetch()}
                size="sm"
                variant="outline"
              >
                <ButtonText>Retry</ButtonText>
              </Button>
            </VStack>
          ) : selectedDate ? (
            <EmptyState
              heading="Nothing scheduled"
              icon="CalendarDays"
              subtext="No events planned for this day."
            />
          ) : (
            <EmptyState
              heading="Nothing on the calendar yet"
              icon="CalendarDays"
              subtext="Tap + to add the first one."
            />
          )
        }
        ListFooterComponent={
          events.length === 0 ? null : eventsView.hasNextPage ? (
            <LoadMoreFooter isLoading={eventsView.isFetchingNextPage} />
          ) : (
            <AllCaughtUp />
          )
        }
        ListHeaderComponent={
          <VStack className="pb-1" space="md">
            <ScreenTitle
              eyebrow="This week at the lake"
              onSearch={() => router.push('/search')}
              right={<CreateButton onPress={() => setComposing(true)} />}
              title="Events"
            />

            <EventsCalendar
              dates={dates.data ?? []}
              onSelectedDateChange={setSelectedDate}
              selectedDate={selectedDate}
            />

            {eventsView.isPending || eventsView.isError ? null : (
              <>
                {featured ? (
                  <FeaturedEventCard
                    event={featured}
                    onOpen={onOpenEvent}
                    onToggleJoin={handleToggleJoin}
                  />
                ) : null}
                {events.length === 0 ? null : (
                  <Text className="px-5 py-1 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                    Coming up
                  </Text>
                )}
              </>
            )}
          </VStack>
        }
        onEndReached={() => {
          if (eventsView.hasNextPage && !eventsView.isFetchingNextPage) {
            void eventsView.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        onRefresh={() => {
          void eventsView.refetch();
          void dates.refetch();
        }}
        refreshing={eventsView.isRefetching || dates.isRefetching}
        renderItem={({ item }) => (
          <View className="mx-5 mb-2">
            <EventRow
              event={item}
              onOpen={onOpenEvent}
              onToggleJoin={handleToggleJoin}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      <Sheet onClose={() => setComposing(false)} visible={composing}>
        <EventComposer
          isSubmitting={createEvent.isPending}
          onDismiss={() => setComposing(false)}
          onSubmit={(draft) =>
            createEvent.mutate(
              {
                date: draft.date,
                newMedia: draft.newMedia,
                place: draft.place,
                tag: draft.tag,
                time: draft.time,
                title: draft.title,
              },
              {
                onSuccess: () => {
                  setComposing(false);
                  showToast('Event created!');
                },
              },
            )
          }
        />
      </Sheet>

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
