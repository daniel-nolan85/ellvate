import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const COLOR_ICON = 'rgb(169,156,139)';

// The "nothing here yet" treatment every list screen should use -- an icon,
// a short heading, and a muted subtext explaining what to do about it.
// Pulled out of Services/Forum (the first two screens to use this exact
// shape) once Events, Missions, Petitions, Leaderboard, and Bookmarks all
// needed the identical look instead of each screen's own plain sentence.
export function EmptyState({
  heading,
  icon,
  subtext,
}: {
  readonly icon: AppIconName;
  readonly heading: string;
  readonly subtext: string;
}) {
  return (
    <VStack className="items-center px-10 py-16" space="xs">
      <Icon color={COLOR_ICON} name={icon} size={28} />
      <Text
        className="text-center font-inter-semibold text-content"
        size="sm"
      >
        {heading}
      </Text>
      <Text className="text-center text-text-muted" size="xs">
        {subtext}
      </Text>
    </VStack>
  );
}
