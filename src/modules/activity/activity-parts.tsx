import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Badge } from '@/src/components/ui/badge';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { ProgressRing } from '@/src/components/ui/progress-ring';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';

const RING_COLOR = 'rgb(181,80,44)';
const RING_TRACK_COLOR = 'rgb(238,231,219)';
const COUNT_UP_MS = 700;

// Ticks a displayed integer from its previous value up (or down) to `target`
// over COUNT_UP_MS, easing out -- plain requestAnimationFrame rather than
// Reanimated, since nothing here is gesture-driven or needs to run on the UI
// thread; a handful of RAF ticks moving a small integer is not something
// Reanimated's worklet machinery is needed for. Re-triggers on every change
// to `target` (e.g. a pull-to-refresh that changes a count), always
// animating from wherever the previous tick left off rather than resetting
// to 0 each time.
function useCountUp(target: number): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const firstRunRef = useRef(true);

  useEffect(() => {
    // Skip the animation on first mount -- a card animating up from 0 the
    // instant this screen appears reads as loading-in-progress; only a
    // value that actually *changes* after that (a refresh, a new post)
    // should visibly count.
    if (firstRunRef.current) {
      firstRunRef.current = false;
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      return;
    }
    let frame: number;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(Math.round(from + delta * eased));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

// Animates ProgressRing's own `progress` prop toward `target` on mount/
// change -- ProgressRing itself just draws whatever fraction it's given
// (see its own file); CommitStep's hold-to-confirm ring is the existing
// precedent for driving it from a Reanimated shared value instead of
// jumping straight to the final fraction.
function useAnimatedRingProgress(target: number): number {
  const shared = useSharedValue(0);
  const [display, setDisplay] = useState(0);

  useAnimatedReaction(
    () => shared.value,
    (value) => {
      runOnJS(setDisplay)(value);
    },
  );

  useEffect(() => {
    shared.value = withTiming(target, {
      duration: COUNT_UP_MS,
      easing: Easing.out(Easing.quad),
    });
  }, [target, shared]);

  return display;
}

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
  const displayValue = useCountUp(value);
  return (
    <VStack
      className="flex-1 items-center rounded-2xl border border-surface-hairline bg-paper px-1.5 py-3.5 shadow-card"
      space="xs"
    >
      <Text className="font-inter-bold text-[20px] text-content">{displayValue}</Text>
      <Text className="text-center text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

// A fixed-width sibling of StatBox for use inside StatRow's horizontal
// scroll below -- flex-1 (StatBox's own sizing) only makes sense splitting
// a fixed number of items evenly across a non-scrolling row.
export function StatCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  const displayValue = useCountUp(value);
  return (
    <VStack
      className="w-[96px] items-center rounded-2xl border border-surface-hairline bg-paper px-2 py-3.5 shadow-card"
      space="xs"
    >
      <Text className="font-inter-bold text-[20px] text-content">{displayValue}</Text>
      <Text className="text-center text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

// The one stat with a natural "progress toward a goal" reading -- missions
// you've engaged with (created or accepted) that are now done -- gets a
// ring instead of a bare number, echoing the same visual language as the
// onboarding commit step and the Profile screen's own level-progress bar
// rather than introducing a new one. completed/total both being 0 (no
// mission activity yet) reads as an empty ring, not a divide-by-zero NaN.
export function MissionProgressStatCard({
  completed,
  total,
}: {
  readonly completed: number;
  readonly total: number;
}) {
  const fraction = total > 0 ? completed / total : 0;
  const ringProgress = useAnimatedRingProgress(fraction);
  const displayCompleted = useCountUp(completed);
  return (
    <VStack
      className="w-[96px] items-center rounded-2xl border border-surface-hairline bg-paper px-2 py-3.5 shadow-card"
      space="xs"
    >
      <ProgressRing
        color={RING_COLOR}
        progress={ringProgress}
        size={52}
        strokeWidth={5}
        trackColor={RING_TRACK_COLOR}
      >
        <Text className="font-inter-bold text-[15px] text-content">
          {displayCompleted}
        </Text>
      </ProgressRing>
      <Text className="text-center text-text-muted" size="xs">
        Missions completed
      </Text>
    </VStack>
  );
}

// A horizontally scrolling row of StatCard/MissionProgressStatCard --
// unlike StatBox's flex-1 row (a fixed 5 items, no ambiguity to split
// further), ActivityScreen's own stat row needs room for Events and
// Missions each broken into two figures (created vs attended/completed) to
// resolve what used to be one combined, ambiguous count -- 7 cards no
// longer fit evenly in a fixed-width row the way 5 did.
export function StatRow({ children }: { readonly children: ReactNode }) {
  return (
    <ScrollView
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {children}
    </ScrollView>
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
  onRefresh,
  refreshing,
  sections,
}: {
  readonly sections: readonly ActivitySection[];
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  // Omit entirely for a preview (e.g. "All") that caps its own row count
  // and never needs more; pass the active single filter's own paginated
  // query to fetch further pages as the user scrolls.
  readonly loadMore?: ActivityLoadMoreTarget;
  // Both omitted together where pull-to-refresh doesn't apply; otherwise
  // pass the caller's own combined refetch of every underlying query (not
  // just the active filter's), since switching filters shows already-
  // fetched data instantly rather than fetching fresh per filter.
  readonly refreshing?: boolean;
  readonly onRefresh?: () => void;
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
      onRefresh={onRefresh}
      refreshing={refreshing ?? false}
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
