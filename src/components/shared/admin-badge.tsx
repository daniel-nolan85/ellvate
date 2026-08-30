import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { CATEGORY_ACCENT_ICON_COLOR } from '@/src/lib/category-accent';

// Reuses the "accent" category color -- the same one already meaning
// "official channel" for Announcements/HOA forum posts -- so an admin mark
// reads as part of the same visual language, not a new color of its own.
const BADGE_COLOR = CATEGORY_ACCENT_ICON_COLOR.accent;

interface AdminBadgeProps {
  readonly isAdmin: boolean;
}

// The word "Admin" next to an admin's name on their own content, so members
// can tell genuinely official posts/events/missions/services/reviews apart
// from someone impersonating an admin with a similar display name. Title
// case + a shield-user glyph reads as a role marker rather than a shout.
export function AdminBadge({ isAdmin }: AdminBadgeProps) {
  if (!isAdmin) {
    return null;
  }

  return (
    <HStack
      accessibilityLabel="Posted by an eLLVate admin"
      accessibilityRole="text"
      className="items-center gap-1"
    >
      <Icon color={BADGE_COLOR} name="ShieldUser" size={12} />
      <Text
        className="font-inter-bold text-[11px] tracking-[0.2px]"
        style={{ color: BADGE_COLOR }}
      >
        Admin
      </Text>
    </HStack>
  );
}
