import { View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { ScreenTitle } from '@/src/modules/community-shell';

interface PetitionsGateWallProps {
  readonly usersNeeded: number;
}

// Shown instead of the real petitions feature while the community is below
// PETITIONS_UNLOCK_MIN_USERS -- see src/backend/petitions/types.ts. Below
// that size, 20% of the community is too small a number to mean anything,
// so the feature stays hidden until there's actually a meaningful bar to
// clear.
export function PetitionsGateWall({ usersNeeded }: PetitionsGateWallProps) {
  return (
    <View className="flex-1 bg-canvas">
      <ScreenTitle eyebrow="Coming soon" title="Petitions" />
      {/* pb reserves space for the floating tab bar (~68px + bottom offset),
          which sits absolutely positioned and doesn't take layout space
          otherwise -- without it, "centered" is centered including the area
          behind the tab bar, reading as noticeably low. */}
      <VStack className="flex-1 items-center justify-center gap-3 px-8 pb-[100px]">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Icon color="rgb(120,108,94)" name="FileSignature" size={28} />
        </View>
        <Text className="text-center font-inter-bold text-[17px] text-content">
          Petitions unlock as the community grows
        </Text>
        <Text className="text-center text-[14px] leading-5 text-text-muted">
          {usersNeeded > 0
            ? `${usersNeeded} more ${usersNeeded === 1 ? 'neighbor needs' : 'neighbors need'} to join before petitions open — this keeps the signature goal meaningful, whatever size the community ends up.`
            : 'Petitions are almost ready to open.'}
        </Text>
      </VStack>
    </View>
  );
}
