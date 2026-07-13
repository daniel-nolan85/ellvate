import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { EventComposer } from './event-composer';
import { EventRow } from './event-row';
import { FeaturedEventCard } from './featured-event-card';
import { useCreateEvent, useEventsView, useToggleJoin } from './use-events';
import { WeekStrip } from './week-strip';

import type { EventsView } from './events-types';

function EventsBody({
  onToggleJoin,
  view,
}: {
  readonly onToggleJoin: (eventId: string) => void;
  readonly view: EventsView;
}) {
  const featured = view.events.find((event) => event.featured);
  const rest = view.events.filter((event) => event !== featured);

  return (
    <>
      <WeekStrip week={view.week} />
      {featured ? (
        <FeaturedEventCard event={featured} onToggleJoin={onToggleJoin} />
      ) : null}
      <VStack className="px-5 pt-1" space="xs">
        <Text className="py-1 font-inter-bold text-[11px] uppercase tracking-[1px] text-muted-foreground">
          Coming up
        </Text>
        {view.events.length === 0 ? (
          <Text className="py-2 text-muted-foreground" size="sm">
            Nothing on the calendar yet. Tap + to add the first one.
          </Text>
        ) : (
          <VStack space="sm">
            {rest.map((event) => (
              <EventRow event={event} key={event.id} onToggleJoin={onToggleJoin} />
            ))}
          </VStack>
        )}
      </VStack>
    </>
  );
}

function AddButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Add event"
      accessibilityRole="button"
      className="h-10 w-10 items-center justify-center rounded-full bg-primary"
      onPress={onPress}
      testID="events-add"
    >
      <Icon color="#fff" name="Add" size={20} />
    </Pressable>
  );
}

export function EventsScreen() {
  const eventsView = useEventsView();
  const toggleJoin = useToggleJoin();
  const createEvent = useCreateEvent();
  const [composing, setComposing] = useState(false);

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
            right={
              <HStack className="items-center" space="sm">
                <AddButton onPress={() => setComposing(true)} />
                <Box className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  <Icon name="Search" size={18} />
                </Box>
              </HStack>
            }
            title="Events"
          />

          {eventsView.isPending ? (
            <Box className="items-center justify-center py-24">
              <Spinner />
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
            <EventsBody onToggleJoin={handleToggleJoin} view={eventsView.data} />
          )}
        </VStack>
      </ScrollView>

      <Sheet onClose={() => setComposing(false)} visible={composing}>
        {eventsView.data ? (
          <EventComposer
            isSubmitting={createEvent.isPending}
            onDismiss={() => setComposing(false)}
            onSubmit={(input) =>
              createEvent.mutate(input, {
                onSuccess: () => setComposing(false),
              })
            }
            week={eventsView.data.week}
          />
        ) : null}
      </Sheet>
    </>
  );
}
