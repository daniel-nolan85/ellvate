import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AllCaughtUp } from '@/src/components/shared/all-caught-up';
import { SearchSheet } from '@/src/components/shared/search-sheet';
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
import { useCreateEvent, useEventsView, useToggleJoin } from './use-events';

import type { EventsView } from './events-types';

const COLOR_ACCENT_FOREGROUND = 'rgb(255,255,255)';

function EventsBody({
  onOpenEvent,
  onToggleJoin,
  view,
}: {
  readonly onOpenEvent?: (eventId: string) => void;
  readonly onToggleJoin: (eventId: string) => void;
  readonly view: EventsView;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const visibleEvents = selectedDate
    ? view.events.filter((event) => event.startsAt.slice(0, 10) === selectedDate)
    : view.events;
  const featured = visibleEvents.find((event) => event.featured);
  const rest = visibleEvents.filter((event) => event !== featured);

  return (
    <>
      <EventsCalendar
        events={view.events}
        onSelectedDateChange={setSelectedDate}
        selectedDate={selectedDate}
      />
      {featured ? (
        <FeaturedEventCard
          event={featured}
          onOpen={onOpenEvent}
          onToggleJoin={onToggleJoin}
        />
      ) : null}
      <VStack className="px-5 pt-1" space="xs">
        <Text className="py-1 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
          Coming up
        </Text>
        {visibleEvents.length === 0 ? (
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
                onToggleJoin={onToggleJoin}
              />
            ))}
            <AllCaughtUp />
          </VStack>
        )}
      </VStack>
    </>
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
  const eventsView = useEventsView();
  const toggleJoin = useToggleJoin();
  const createEvent = useCreateEvent();
  const [composing, setComposing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleToggleJoin = (eventId: string) => {
    toggleJoin.mutate(eventId);
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerClassName="pb-[130px]"
        showsVerticalScrollIndicator={false}
      >
        <VStack space="md">
          <ScreenTitle
            eyebrow="This week at the lake"
            onSearch={() => setIsSearching(true)}
            right={<CreateButton onPress={() => setComposing(true)} />}
            title="Events"
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
            <EventsBody
              onOpenEvent={onOpenEvent}
              onToggleJoin={handleToggleJoin}
              view={eventsView.data}
            />
          )}
        </VStack>
      </ScrollView>

      <Sheet onClose={() => setComposing(false)} visible={composing}>
        {eventsView.data ? (
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
        ) : null}
      </Sheet>

      <SearchSheet
        getKey={(event) => event.id}
        getSubtitle={(event) => event.place}
        getTitle={(event) => event.title}
        items={eventsView.data?.events ?? []}
        onClose={() => setIsSearching(false)}
        onSelect={(event) => onOpenEvent?.(event.id)}
        placeholder="Search events"
        visible={isSearching}
      />
    </>
  );
}
