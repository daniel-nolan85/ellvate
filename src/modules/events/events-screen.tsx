import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { router } from 'expo-router';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dates = useEventDates();
  const eventsView = useEventsView(selectedDate);
  const toggleJoin = useToggleJoin();
  const createEvent = useCreateEvent();
  const [composing, setComposing] = useState(false);

  const events = eventsView.data?.pages.flatMap((page) => page.events) ?? [];
  // Sorted featured-first server-side, so the very first item (if featured)
  // is always the one to pull out for the hero card.
  const featured = events[0]?.featured ? events[0] : undefined;
  const rest = featured ? events.slice(1) : events;

  const handleToggleJoin = (eventId: string) => {
    toggleJoin.mutate(eventId);
  };

  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: eventsView.fetchNextPage,
      hasNextPage: eventsView.hasNextPage,
      isFetchingNextPage: eventsView.isFetchingNextPage,
    },
  ]);

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="pb-[130px]"
        onScroll={onScroll}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
      >
        <VStack space="md">
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

          {eventsView.isPending ? (
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
          ) : (
            <>
              {featured ? (
                <FeaturedEventCard
                  event={featured}
                  onOpen={onOpenEvent}
                  onToggleJoin={handleToggleJoin}
                />
              ) : null}
              <VStack className="px-5 pt-1" space="xs">
                <Text className="py-1 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
                  Coming up
                </Text>
                {events.length === 0 ? (
                  <Text className="py-2 text-muted-foreground" size="sm">
                    {selectedDate
                      ? 'Nothing scheduled for this day.'
                      : 'Nothing on the calendar yet. Tap + to add the first one.'}
                  </Text>
                ) : (
                  <VStack space="sm">
                    {rest.map((event) => (
                      <EventRow
                        event={event}
                        key={event.id}
                        onOpen={onOpenEvent}
                        onToggleJoin={handleToggleJoin}
                      />
                    ))}
                    {eventsView.hasNextPage ? (
                      <LoadMoreFooter isLoading={eventsView.isFetchingNextPage} />
                    ) : (
                      <AllCaughtUp />
                    )}
                  </VStack>
                )}
              </VStack>
            </>
          )}
        </VStack>
      </ScrollView>

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
              { onSuccess: () => setComposing(false) },
            )
          }
        />
      </Sheet>
    </>
  );
}
