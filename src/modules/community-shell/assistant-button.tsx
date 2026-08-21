import { Pressable, View, type ViewStyle } from 'react-native';

import * as Haptics from 'expo-haptics';

import { AiMark } from '@/src/components/ui/ai-mark';

const glowShadow: ViewStyle = {
  shadowColor: 'rgb(181,80,44)',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.5,
  shadowRadius: 9,
  elevation: 10,
};

interface AssistantButtonProps {
  readonly onPress: () => void;
  readonly style?: ViewStyle;
}

// Extracted out of the floating tab bar (see floating-tab-bar.tsx) so it can
// be mounted once at the root layout instead of being duplicated across
// every screen that needs to show the nav (the previous per-screen
// CommunityNavBar pattern). It's a different kind of control than the five
// content-pillar tabs -- "invoke a tool" rather than "browse a list" -- which
// is exactly why it keeps its distinct raised/glowing treatment instead of
// folding into the flat tab row.
export function AssistantButton({ onPress, style }: AssistantButtonProps) {
  const handlePress = () => {
    void Haptics.selectionAsync();
    onPress();
  };
  return (
    <Pressable
      accessibilityLabel="Open assistant"
      accessibilityRole="button"
      onPress={handlePress}
      style={style}
      testID="open-assistant"
    >
      {({ pressed }) => (
        <View
          className="h-[52px] w-[52px] items-center justify-center rounded-full bg-accent"
          style={[glowShadow, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <AiMark color="#ffffff" size={24} />
        </View>
      )}
    </Pressable>
  );
}
