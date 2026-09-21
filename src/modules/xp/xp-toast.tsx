import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

const AMBER = 'rgb(217,123,41)';

interface XpToastProps {
  readonly amount: number | null;
  readonly onHide: () => void;
}

// A lightweight, auto-dismissing pill for the routine case -- most XP
// awards (creating a post/event/mission/service, or a mission check-in
// that doesn't cross a level boundary) don't warrant a full-screen modal.
// Rendered by XpFeedbackProvider above every screen (the same "float above
// the floating tab bar" position AssistantButton uses in app/_layout.tsx),
// so it's visible no matter which screen triggered the award.
export function XpToast({ amount, onHide }: XpToastProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (amount === null) {
      return;
    }
    const timeout = setTimeout(onHide, 2200);
    return () => clearTimeout(timeout);
  }, [amount, onHide]);

  if (amount === null) {
    return null;
  }

  return (
    <View
      className="absolute left-[18px] right-[18px] flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3"
      pointerEvents="none"
      style={{ bottom: Math.max(20, insets.bottom + 8) + 68 + 16, zIndex: 20 }}
    >
      <Icon color={AMBER} name="Star" size={15} />
      <Text className="font-inter-semibold text-[14px] text-primary-foreground">
        +{amount} XP
      </Text>
    </View>
  );
}
