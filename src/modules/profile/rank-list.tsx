import { View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { currentRankIndex, rankLevelRange, RANK_TIERS } from './ranks';

// The full rank ladder, current tier highlighted -- shown at the top of the
// History tab so a member can see what they're building toward, not just
// what they've already earned.
export function RankList({ level }: { readonly level: number }) {
  const activeIndex = currentRankIndex(level);

  return (
    <VStack className="mx-5 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
      {RANK_TIERS.map((tier, index) => {
        const isCurrent = index === activeIndex;
        return (
          <HStack
            className={`items-center gap-3 border-b border-surface-hairline px-4 py-3 ${
              isCurrent ? 'bg-accent' : ''
            }`}
            key={tier.title}
          >
            <View
              className={`h-8 w-8 items-center justify-center rounded-full ${
                isCurrent ? 'bg-[rgba(250,250,250,0.2)]' : 'bg-secondary'
              }`}
            >
              <Icon
                color={isCurrent ? 'rgb(250,250,250)' : 'rgb(181,80,44)'}
                name="Trophy"
                size={15}
              />
            </View>
            <Text
              className={`flex-1 font-inter-semibold text-[14px] ${
                isCurrent ? 'text-accent-foreground' : 'text-content'
              }`}
            >
              {tier.title}
            </Text>
            <Text
              className={`font-inter-medium text-[12px] ${
                isCurrent ? 'text-[rgba(250,250,250,0.75)]' : 'text-text-muted'
              }`}
            >
              Level {rankLevelRange(index)}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
