import { ScrollView } from 'react-native';

import { Box } from '@/src/components/ui/box';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

import { LeaderRow } from './leader-row';
import { Podium } from './podium';
import { useLeaderboard } from './use-leaderboard';

export function LeaderboardScreen() {
  const leaderboard = useLeaderboard();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingBottom: 130 }}
    >
      <VStack space="md">
        <ScreenTitle eyebrow="This month" title="Leaderboard" />
        {leaderboard.isPending ? (
          <Box className="items-center justify-center py-24">
            <Spinner />
          </Box>
        ) : leaderboard.isError ? (
          <VStack className="items-center px-5 py-16" space="md">
            <Text className="text-center text-muted-foreground" size="sm">
              Could not load the leaderboard.
            </Text>
            <Button
              action="secondary"
              className="rounded-full"
              onPress={() => void leaderboard.refetch()}
              size="sm"
              variant="outline"
            >
              <ButtonText>Retry</ButtonText>
            </Button>
          </VStack>
        ) : (
          <>
            <Podium leaders={leaderboard.data.leaders} />
            <VStack className="px-5 pt-1.5" space="xs">
              {leaderboard.data.leaders.map((entry) => (
                <LeaderRow entry={entry} key={entry.rank} />
              ))}
            </VStack>
          </>
        )}
      </VStack>
    </ScrollView>
  );
}
