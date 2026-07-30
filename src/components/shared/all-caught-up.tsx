import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

const COLOR_MUTED = 'rgb(169,156,139)';

// Shown at the bottom of a fully-loaded list — none of the community feeds
// paginate yet (they fetch everything in one request), so "caught up" is
// true as soon as the list has rendered, not the result of reaching a
// page-fetch boundary.
export function AllCaughtUp() {
  return (
    <HStack className="items-center justify-center gap-1.5 py-6">
      <Icon color={COLOR_MUTED} name="CheckCircle" size={14} />
      <Text className="text-text-muted" size="xs">
        You&apos;re all caught up
      </Text>
    </HStack>
  );
}
