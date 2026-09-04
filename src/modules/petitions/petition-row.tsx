import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminBadge } from '@/src/components/shared/admin-badge';
import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Sheet } from '@/src/components/ui/sheet';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime, formatRelativeTimeUntil } from '@/src/lib/relative-time';
import { BookmarkButton } from '@/src/modules/bookmarks';
import { useOpenProfile } from '@/src/modules/profile';

import { useReportPetition } from './use-petitions';
import { PETITION_CATEGORIES, type Petition } from './petitions-types';

const COLOR_TEXT_SUBTLE = 'rgb(169,156,139)';
const COLOR_DESTRUCTIVE = 'rgb(231,0,11)';

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
  const insets = useSafeAreaInsets();
  const openProfile = useOpenProfile();
  const reportPetition = useReportPetition();

  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleReport = () => {
    setMenuOpen(false);
    reportPetition.mutate(petition.id, {
      onError: () => showToast('Couldn’t submit your report. Try again.'),
      onSuccess: () => showToast('Thanks — our moderators will take a look.'),
    });
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        className="gap-2.5 rounded-[16px] border border-surface-hairline bg-paper p-4"
        onPress={() => onOpen?.(petition.id)}
        testID={`petition-row-${petition.id}`}
      >
        <HStack className="items-center" space="xs">
          <HStack className="flex-1 items-center" space="xs">
            <Badge variant="muted">{categoryLabel(petition.category)}</Badge>
            {petition.status === 'succeeded' ? <Badge variant="success">Succeeded</Badge> : null}
            {petition.status === 'expired' ? <Badge variant="destructive">Expired</Badge> : null}
          </HStack>
          <BookmarkButton targetId={petition.id} targetType="petition" />
          <Pressable
            accessibilityLabel="More options"
            accessibilityRole="button"
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              setMenuOpen(true);
            }}
          >
            <Icon color={COLOR_TEXT_SUBTLE} name="ThreeDots" size={16} />
          </Pressable>
        </HStack>
        <Text className="font-inter-bold text-[16px] text-content">{petition.title}</Text>
        <Text className="text-[13px] text-text-muted" numberOfLines={2}>
          {petition.description}
        </Text>
        <SignatureProgress
          requiredSignatures={petition.requiredSignatures}
          signatureCount={petition.signatureCount}
        />
        <Pressable
          accessibilityLabel={`Started by ${petition.createdBy.name}`}
          accessibilityRole="button"
          className="flex-row items-center gap-1.5"
          hitSlop={4}
          onPress={(event) => {
            event.stopPropagation();
            openProfile(petition.createdBy.id, petition.createdBy.name);
          }}
        >
          <Text className="text-[12px] text-text-muted">
            Started by <Text className="font-inter-semibold text-content">{petition.createdBy.name}</Text>
          </Text>
          <AdminBadge isAdmin={petition.createdBy.isAdmin} />
        </Pressable>
        <HStack className="items-center gap-1.5">
          <Icon color="rgb(120,108,94)" name="Clock" size={14} />
          <Text className="text-[12px] text-text-muted">
            {petition.status === 'open'
              ? `Closes ${formatRelativeTimeUntil(petition.deadlineAt)}`
              : `${petition.status === 'succeeded' ? 'Succeeded' : 'Closed'} ${formatRelativeTime(petition.succeededAt ?? petition.deadlineAt)}`}
          </Text>
        </HStack>
      </Pressable>

      <Sheet onClose={() => setMenuOpen(false)} visible={menuOpen}>
        <View className="gap-1 px-[18px] pb-2">
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 px-1.5 py-3.5"
            onPress={handleReport}
          >
            <Icon color={COLOR_DESTRUCTIVE} name="AlertCircle" size={20} />
            <Text className="text-[15px]" style={{ color: COLOR_DESTRUCTIVE, fontWeight: '500' }}>
              Report petition
            </Text>
          </Pressable>
        </View>
      </Sheet>

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon color="rgb(250,250,250)" name="CheckCircle" size={16} />
          <Text className="flex-1 text-[14px] text-primary-foreground">{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}
