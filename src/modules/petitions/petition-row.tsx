import { Pressable, View } from 'react-native';

import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTimeUntil } from '@/src/lib/relative-time';

import { PETITION_CATEGORIES, type Petition } from './petitions-types';

const categoryLabel = (value: Petition['category']): string =>
  PETITION_CATEGORIES.find((option) => option.value === value)?.label ?? value;

interface SignatureProgressProps {
  readonly signatureCount: number;
  readonly requiredSignatures: number;
}

function SignatureProgress({ signatureCount, requiredSignatures }: SignatureProgressProps) {
  const pct = Math.min(100, Math.round((signatureCount / requiredSignatures) * 100));
  return (
    <VStack space="xs">
      <View className="h-2 overflow-hidden rounded-full bg-secondary">
        <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-[12px] text-text-muted">
        {signatureCount} of {requiredSignatures} signatures
      </Text>
    </VStack>
  );
}

interface PetitionRowProps {
  readonly petition: Petition;
  readonly onOpen?: (petitionId: string) => void;
}

export function PetitionRow({ petition, onOpen }: PetitionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className="gap-2.5 rounded-[16px] border border-surface-hairline bg-paper p-4"
      onPress={() => onOpen?.(petition.id)}
      testID={`petition-row-${petition.id}`}
    >
      <HStack className="items-center" space="xs">
        <Badge variant="muted">{categoryLabel(petition.category)}</Badge>
        {petition.status === 'succeeded' ? <Badge variant="success">Succeeded</Badge> : null}
        {petition.status === 'expired' ? <Badge variant="muted">Expired</Badge> : null}
      </HStack>
      <Text className="font-inter-bold text-[16px] text-content">{petition.title}</Text>
      <Text className="text-[13px] text-text-muted" numberOfLines={2}>
        {petition.description}
      </Text>
      <SignatureProgress
        requiredSignatures={petition.requiredSignatures}
        signatureCount={petition.signatureCount}
      />
      <HStack className="items-center gap-1.5">
        <Icon color="rgb(120,108,94)" name="Clock" size={14} />
        <Text className="text-[12px] text-text-muted">
          {petition.status === 'open'
            ? `Closes ${formatRelativeTimeUntil(petition.deadlineAt)}`
            : `Started by ${petition.createdBy.name}`}
        </Text>
      </HStack>
    </Pressable>
  );
}
