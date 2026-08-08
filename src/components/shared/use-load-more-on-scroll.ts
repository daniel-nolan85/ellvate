import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// How close to the bottom (in px of remaining content) before the next page
// starts loading -- large enough that it fires before the user hits the
// literal end and sees a blank gap while the request is in flight.
const TRIGGER_DISTANCE_PX = 400;

export interface LoadMoreTarget {
  readonly hasNextPage: boolean | undefined;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => unknown;
}

// Drives auto-load-on-scroll for one or more paginated queries sharing a
// single ScrollView (e.g. Activity Hub's four sections). Pass it straight to
// ScrollView's onScroll -- it doesn't need to be memoized, since ScrollView
// doesn't rely on a stable onScroll identity the way FlatList's renderItem does.
export function useLoadMoreOnScroll(
  targets: readonly LoadMoreTarget[],
): (event: NativeSyntheticEvent<NativeScrollEvent>) => void {
  return (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd =
      contentSize.height - contentOffset.y - layoutMeasurement.height;
    if (distanceFromEnd > TRIGGER_DISTANCE_PX) {
      return;
    }
    for (const target of targets) {
      if (target.hasNextPage && !target.isFetchingNextPage) {
        void target.fetchNextPage();
      }
    }
  };
}
