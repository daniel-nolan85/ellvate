import { View } from 'react-native';

import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { LeaderboardEntry } from './use-leaderboard';

const MEDAL_CLASS_BY_RANK: Readonly<Record<number, string>> = {
  1: 'bg-indigo',
  2: 'bg-[rgb(148,152,163)]',
  3: 'bg-[rgb(196,132,72)]',
};

interface PodiumProps {
  readonly leaders: readonly LeaderboardEntry[];
}

function PodiumAvatar({ entry }: { readonly entry: LeaderboardEntry }) {
  const first = entry.rank === 1;

  return (
    <View className="relative mb-1">
      {first ? (
        <View className="rounded-full bg-indigo p-[3px]">
          <View className="rounded-full bg-canvas p-[3px]">
            <Avatar name={entry.user.name} size="xl" src={entry.user.avatarUrl ?? undefined} />
          </View>
        </View>
      ) : (
        <Avatar name={entry.user.name} size="lg" src={entry.user.avatarUrl ?? undefined} />
      )}
      <View className="absolute -bottom-2 left-0 right-0 items-center">
        <View className="rounded-full bg-canvas p-[2px]">
          <View
            className={`h-[22px] w-[22px] items-center justify-center rounded-full ${MEDAL_CLASS_BY_RANK[entry.rank] ?? 'bg-indigo'}`}
          >
            <Text className="font-inter-bold text-[11px] leading-[13px] text-white">
              {entry.rank}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PodiumColumn({ entry }: { readonly entry: LeaderboardEntry }) {
  const first = entry.rank === 1;

  return (
    <VStack className="w-[100px] items-center" space="xs">
      <PodiumAvatar entry={entry} />
      <Text className="mt-1 font-inter-bold text-content" size="sm">
        {entry.user.name}
      </Text>
      <Text
        className={`font-inter-bold text-content ${first ? 'text-[20px] leading-[24px] tracking-[-0.4px]' : 'text-[16px] leading-[20px] tracking-[-0.32px]'}`}
      >
        {entry.missionsCompleted}
      </Text>
      <Text className="-mt-1 text-muted-foreground" size="xs">
        missions
      </Text>
    </VStack>
  );
}

export function Podium({ leaders }: PodiumProps) {
  const topThree = [...leaders]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3);

  if (topThree.length < 3) {
    return null;
  }

  const arranged = [topThree[1], topThree[0], topThree[2]];

  return (
    <HStack className="items-end justify-center px-5 pt-2.5" space="sm">
      {arranged.map((entry) => (
        <PodiumColumn entry={entry} key={entry.rank} />
      ))}
    </HStack>
  );
}
