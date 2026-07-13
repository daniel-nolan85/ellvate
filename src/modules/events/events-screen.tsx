import { ScrollView } from 'react-native';

import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Icon } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { EventRow } from './event-row';
import { FeaturedEventCard } from './featured-event-card';
import { useEventsView, useToggleJoin } from './use-events';
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
        <VStack space="sm">
          {rest.map((event) => (
            <EventRow event={event} key={event.id} onToggleJoin={onToggleJoin} />
          ))}
        </VStack>
      </VStack>
    </>
  );
}

export function EventsScreen() {
  const eventsView = useEventsView();
  const toggleJoin = useToggleJoin();

  const handleToggleJoin = (eventId: string) => {
    toggleJoin.mutate(eventId);
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerClassName="pb-[130px]"
      showsVerticalScrollIndicator={false}
    >
      <VStack space="md">
        <ScreenTitle
          eyebrow="This week at the lake"
          right={
            <Box className="h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <Icon name="Search" size={18} />
            </Box>
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
  );
}
