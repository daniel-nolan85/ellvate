import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
// No 'all' option -- see FILTERS below for why.
export type ActivityFilter = ActivityKind;

export const KIND_ICON: Readonly<Record<ActivityKind, AppIconName>> = {
  event: 'CalendarDays',
  mission: 'Star',
  petition: 'FileSignature',
  post: 'MessageCircle',
  service: 'Store',
};

// Deliberately no "All" option combining every kind into one screen. That
// combined view (up to five sections' worth of rows all mounting alongside
// this pill row) was the confirmed, reproducible cause of a real on-device
// bug: the inactive pills' text corrupting whenever "All" was selected.
// Eleven separate attempts at fixing it -- resizing pills, remounting them,
// deferring the section content's commit via requestAnimationFrame /
// InteractionManager / setTimeout, capping preview rows, and finally
// actually virtualizing the list -- each ruled out one mechanism without
// fixing it, while a diagnostic build proved conclusively that content
// volume in this area (however it's mounted) is the real trigger. Rather
// than keep guessing at how much volume is safe, removing the one filter
// that combines multiple sections at once removes the precondition
// entirely: every remaining filter here shows exactly one kind, one
// properly paginated and virtualized list, which has never shown any sign
// of this bug in any of the above attempts.
export const FILTERS: readonly { readonly key: ActivityFilter; readonly label: string }[] = [
  { key: 'post', label: 'Posts' },
  { key: 'event', label: 'Events' },
  { key: 'mission', label: 'Missions' },
  { key: 'service', label: 'Services' },
  { key: 'petition', label: 'Petitions' },
];

export const isActivityFilter = (
  value: string | undefined,
): value is ActivityFilter =>
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
        // stretch, not center: each pill's height was previously left to its
        // own natural content measurement, with nothing forcing them equal.
        // Different labels (different glyph mixes) can measure a pixel or
        // two apart, and on "All" -- the one filter where every pill's
        // native view mounts/re-measures in the same pass as a much heavier
        // sibling commit below -- that per-pill variance is what surfaced as
        // visibly uneven/"squished" pills. stretch makes every pill match
        // the row's own cross-axis size instead of guessing a fixed number
        // (two earlier attempts hardcoded a height/minHeight on individual
        // pills and consistently left "All" shorter than its neighbors,
        // because a guessed constant doesn't necessarily match what the
        // other pills actually need).
        alignItems: 'stretch',
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
  title,
}: {
  readonly count: number;
  readonly title: string;
}) {
  return (
    <HStack className="items-center justify-between px-5 pb-1.5 pt-6">
      <HStack className="items-center gap-2">
        <Text className="font-inter-bold text-[12px] uppercase tracking-[1px] text-text-muted">
          {title}
        </Text>
        <Badge variant="muted">{count}</Badge>
      </HStack>
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

export interface ActivityListItem {
  readonly key: string;
  readonly kind: ActivityKind;
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  readonly onPress: () => void;
}

// One entry in ActivitySectionList's `sections` prop below -- a thin
// SectionList-shaped wrapper around one of Posts/Events/Missions/Services/
// Petitions. In practice there's always exactly one visible section: there's
// no "All" filter combining several at once (see FILTERS above for why).
export interface ActivitySection {
  readonly key: ActivityKind;
  readonly title: string;
  readonly count: number;
  readonly data: readonly ActivityListItem[];
  readonly emptyLabel: string;
}

export interface ActivityLoadMoreTarget {
  readonly hasNextPage: boolean | undefined;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => unknown;
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
      className="mx-5 mb-2 flex-row items-center gap-3 rounded-[14px] border border-surface-hairline bg-paper px-4 py-3.5 shadow-card"
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

// The real fix for the "All" filter pills corrupting: a diagnostic build
// proved (not just theorized) that up to five SectionCards' worth of rows
// -- previously all mounted as real native views at once via a plain
// ScrollView + `.map()`, regardless of what's actually on screen -- is what
// caused it. Delaying *when* that content mounted (three separate attempts:
// requestAnimationFrame, InteractionManager, setTimeout) never changed
// anything, because once mounted it stayed mounted for as long as "All" was
// selected -- delaying the mount doesn't reduce how much of it coexists in
// steady state. SectionList actually virtualizes: only the rows currently
// on screen exist as real native views, no matter how large any one
// section's data grows, which is what a delay could never achieve. Shared
// between ActivityScreen and MemberActivityScreen (see their own callers)
// since both have this exact shape, and it's the template any other
// screen combining a filter-pill row with a growing list should follow
// rather than a plain ScrollView + `.map()`.
export function ActivitySectionList({
  contentContainerStyle,
  loadMore,
  sections,
}: {
  readonly sections: readonly ActivitySection[];
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  // Omit entirely for a preview (e.g. "All") that caps its own row count
  // and never needs more; pass the active single filter's own paginated
  // query to fetch further pages as the user scrolls.
  readonly loadMore?: ActivityLoadMoreTarget;
}) {
  return (
    <SectionList<ActivityListItem, ActivitySection>
      contentContainerStyle={contentContainerStyle}
      keyExtractor={(item) => item.key}
      ListFooterComponent={
        loadMore ? <LoadMoreFooter isLoading={loadMore.isFetchingNextPage} /> : null
      }
      onEndReached={() => {
        if (loadMore?.hasNextPage && !loadMore.isFetchingNextPage) {
          void loadMore.fetchNextPage();
        }
      }}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => (
        <ActivityRow
          kind={item.kind}
          label={item.label}
          onPress={item.onPress}
          subtitle={item.subtitle}
          title={item.title}
        />
      )}
      renderSectionFooter={({ section }) =>
        section.data.length === 0 ? <EmptyHint label={section.emptyLabel} /> : null
      }
      renderSectionHeader={({ section }) => (
        <SectionHeader count={section.count} title={section.title} />
      )}
      sections={sections}
      stickySectionHeadersEnabled={false}
    />
  );
}
