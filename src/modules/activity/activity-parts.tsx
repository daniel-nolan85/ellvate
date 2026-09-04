import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

// Shared between ActivityScreen (your own activity) and MemberActivityScreen
// (a read-only view of someone else's) so both render posts/events/missions/
// services the same way — only where the data comes from differs.

export type ActivityKind = 'post' | 'event' | 'mission' | 'service' | 'petition';
export type ActivityFilter = 'all' | ActivityKind;

export const KIND_ICON: Readonly<Record<ActivityKind, AppIconName>> = {
  event: 'CalendarDays',
  mission: 'Star',
  petition: 'FileSignature',
  post: 'MessageCircle',
  service: 'Store',
};

export const FILTERS: readonly { readonly key: ActivityFilter; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'post', label: 'Posts' },
  { key: 'event', label: 'Events' },
  { key: 'mission', label: 'Missions' },
  { key: 'service', label: 'Services' },
  { key: 'petition', label: 'Petitions' },
];

// How many rows each section shows when "All" is selected -- see
// SectionHeader's onSeeAll and activity-screen.tsx for why.
export const ALL_FILTER_PREVIEW_COUNT = 5;

export const isActivityFilter = (
  value: string | undefined,
): value is ActivityFilter =>
  value === 'all' ||
  value === 'post' ||
  value === 'event' ||
  value === 'mission' ||
  value === 'service' ||
  value === 'petition';

export function FilterChips({
  active,
  onSelect,
}: {
  readonly active: ActivityFilter;
  readonly onSelect: (filter: ActivityFilter) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 2,
      }}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {FILTERS.map((filter) => {
        const isActive = filter.key === active;
        return (
          <Pressable
            // Deliberately identical to Bookmarks' own FilterChips (same
            // filter count, same label set) -- padding-only sizing, no
            // minWidth/height override.
            className={`shrink-0 rounded-full px-3.5 py-[7px] ${
              isActive ? 'bg-accent' : 'bg-secondary'
            }`}
            key={filter.key}
            onPress={() => onSelect(filter.key)}
          >
            {/* allowFontScaling={false}: a fixed leading-[18px] clipped the
                top of these glyphs on a device with a larger OS text-size
                setting -- the actual rendered font grows with that setting
                by default, but the hard-coded 18px line box doesn't grow
                with it, so taller scaled glyphs no longer fit inside it.
                These are short, fixed-purpose labels on a compact pill
                control (not body copy), so opting out of scaling here is
                the same tradeoff a segmented control/tab bar would make. */}
            <Text
              allowFontScaling={false}
              className={`font-inter-medium text-[13px] ${
                isActive ? 'text-accent-foreground' : 'text-secondary-foreground'
              }`}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function StatBox({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <VStack
      className="flex-1 items-center rounded-2xl border border-surface-hairline bg-paper px-1.5 py-3.5 shadow-card"
      space="xs"
    >
      <Text className="font-inter-bold text-[20px] text-content">{value}</Text>
      <Text className="text-center text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

export function SectionHeader({
  count,
  onSeeAll,
  title,
}: {
  readonly count: number;
  readonly title: string;
  // Present only when "All" is selected and this section has more rows than
  // ALL_FILTER_PREVIEW_COUNT -- switches straight to this section's own
  // filter, which shows every row (see activity-screen.tsx).
  readonly onSeeAll?: () => void;
}) {
  return (
    <HStack className="items-center justify-between px-5 pb-1.5 pt-6">
      <HStack className="items-center gap-2">
        <Text className="font-inter-bold text-[12px] uppercase tracking-[1px] text-text-muted">
          {title}
        </Text>
        <Badge variant="muted">{count}</Badge>
      </HStack>
      {onSeeAll ? (
        <Pressable accessibilityRole="button" onPress={onSeeAll}>
          <Text className="font-inter-semibold text-[12px] text-accent">
            See all
          </Text>
        </Pressable>
      ) : null}
    </HStack>
  );
}

export function SectionCard({ children }: { readonly children: ReactNode }) {
  return (
    <VStack className="mx-5 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
      {children}
    </VStack>
  );
}

export function EmptyHint({ label }: { readonly label: string }) {
  return (
    <SectionCard>
      <Text className="px-4 py-4 text-[13px] text-text-muted">{label}</Text>
    </SectionCard>
  );
}

export function LoadMoreFooter({ isLoading }: { readonly isLoading: boolean }) {
  if (!isLoading) {
    return null;
  }
  return (
    <View className="items-center border-t border-surface-hairline py-3">
      <Spinner size="small" />
    </View>
  );
}

export function ActivityRow({
  kind,
  label,
  onPress,
  subtitle,
  title,
}: {
  readonly kind: ActivityKind;
  readonly label: string;
  readonly onPress: () => void;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}: ${title}`}
      accessibilityRole="button"
      className="flex-row items-center gap-3 border-b border-surface-hairline px-4 py-3.5"
      onPress={onPress}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name={KIND_ICON[kind]} size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <Text className="text-[11px] text-text-muted">{label}</Text>
        <Text
          className="font-inter-bold text-[14px] text-content"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-[12px] text-text-muted">{subtitle}</Text>
      </VStack>
      <Icon color="rgb(169,156,139)" name="ChevronRight" size={16} />
    </Pressable>
  );
}
