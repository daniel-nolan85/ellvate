import { HStack } from '@/src/components/ui/hstack';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import { levelCosts } from './ranks';

// How much XP each level takes to complete, shown alongside RankList so a
// member can see not just which rank they're building toward but how much
// each individual level along the way actually costs. Growth flattens out
// at a fixed cap (see ranks.ts's levelCosts), so the last row covers every
// level from there on instead of listing each one individually forever.
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
              {cost.xp} XP{isLast ? ' each' : ''}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
