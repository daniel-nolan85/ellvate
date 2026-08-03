import { View } from 'react-native';

import { Icon } from '@/src/components/ui/icon';

const COLOR_MUTED = 'rgb(169,156,139)';

interface EditedMarkProps {
  readonly editedAt: string | null;
  // Override for cards on a dark/tinted background (e.g. FeaturedEventCard's
  // primary-colored hero) where the default muted-paper color would be
  // unreadable.
  readonly color?: string;
}

// A small pencil next to any content the author has updated at least once —
// posts, events, missions, service listings, and service reviews all track
// editedAt; comments have no edit feature, so they never render this.
export function EditedMark({ color = COLOR_MUTED, editedAt }: EditedMarkProps) {
  if (!editedAt) {
    return null;
  }

  return (
    <View accessibilityLabel="Edited" accessibilityRole="text">
      <Icon color={color} name="Edit" size={11} />
    </View>
  );
}
