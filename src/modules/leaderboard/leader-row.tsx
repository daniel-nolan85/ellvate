import { Avatar } from '@/src/components/ui/avatar';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

import type { LeaderboardEntry } from './use-leaderboard';

const SUCCESS_COLOR = 'rgb(34,197,94)';
const DESTRUCTIVE_COLOR = 'rgb(231,0,11)';

interface LeaderRowProps {
  readonly entry: LeaderboardEntry;
}

export function LeaderRow({ entry }: LeaderRowProps) {
  const me = entry.isMe;

  return (
    <HStack
      className={`items-center gap-3 rounded-[16px] px-3.5 py-3 shadow-card ${me ? 'bg-primary' : 'border border-surface-hairline bg-paper'}`}
    >
      <Text
        className={`w-5 text-center font-inter-bold text-[14px] leading-[18px] ${me ? 'text-primary-foreground' : 'text-text-muted'}`}
      >
        {entry.rank}
      </Text>
      <Avatar name={entry.user.name} size="sm" src={entry.user.avatarUrl ?? undefined} />
      <VStack className="flex-1" space="xs">
        <Text
          className={`font-inter-semibold text-[14px] leading-[18px] ${me ? 'text-primary-foreground' : 'text-content'}`}
        >
          {me ? 'You' : entry.user.name}
        </Text>
        <Text
          className={`text-[11px] leading-[14px] ${me ? 'text-[rgba(250,250,250,0.6)]' : 'text-text-subtle'}`}
        >
          {`${entry.xp.toLocaleString()} XP`}
        </Text>
      </VStack>
      {entry.rankDelta !== 0 ? (
        <Icon
          color={entry.rankDelta > 0 ? SUCCESS_COLOR : DESTRUCTIVE_COLOR}
          name={entry.rankDelta > 0 ? 'ArrowUp' : 'ArrowDown'}
          size={14}
        />
      ) : null}
      <Text
        className={`font-inter-bold text-[15px] leading-[19px] ${me ? 'text-primary-foreground' : 'text-content'}`}
      >
        {entry.missionsCompleted}
      </Text>
    </HStack>
  );
}
