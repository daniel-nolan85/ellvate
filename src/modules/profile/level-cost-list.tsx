import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { levelCosts } from './ranks';

// The cumulative XP a member needs to have earned to reach each level,
// shown alongside RankList so they can see not just which rank they're
// building toward but exactly how much total XP each level requires --
// level 1 is free (0 XP). Growth flattens out at a fixed cap (see
// ranks.ts's levelCosts), so the last row covers the cumulative total to
// reach that level, with every level after it adding a flat amount more.
export function LevelCostList({ level }: { readonly level: number }) {
  const costs = levelCosts();

  return (
    <VStack className="mx-5 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
      {costs.map((cost, index) => {
        const isLast = index === costs.length - 1;
        const isCurrent = isLast ? level >= cost.level : level === cost.level;
        return (
          <HStack
            className={`items-center justify-between border-b border-surface-hairline px-4 py-2.5 ${
              isCurrent ? 'bg-accent' : ''
            }`}
            key={cost.level}
          >
            <Text
              className={`font-inter-semibold text-[13px] ${
                isCurrent ? 'text-accent-foreground' : 'text-content'
              }`}
            >
              {isLast ? `Level ${cost.level}+` : `Level ${cost.level}`}
            </Text>
            <Text
              className={`font-inter-medium text-[12px] ${
                isCurrent ? 'text-[rgba(250,250,250,0.75)]' : 'text-text-muted'
              }`}
            >
              {cost.xp.toLocaleString()} XP{isLast ? ', +900/level after' : ''}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
