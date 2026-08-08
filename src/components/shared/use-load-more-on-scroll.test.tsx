import { renderHook } from '@testing-library/react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useLoadMoreOnScroll, type LoadMoreTarget } from './use-load-more-on-scroll';

function scrollEvent(
  distanceFromEndPx: number,
): NativeSyntheticEvent<NativeScrollEvent> {
  const layoutHeight = 800;
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: 0 },
      contentSize: { height: layoutHeight + distanceFromEndPx, width: 0 },
      layoutMeasurement: { height: layoutHeight, width: 0 },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

function makeTarget(
  overrides: Partial<Omit<LoadMoreTarget, 'fetchNextPage'>> = {},
): LoadMoreTarget & { readonly fetchNextPage: jest.Mock } {
  return {
    fetchNextPage: jest.fn(),
    hasNextPage: true,
    isFetchingNextPage: false,
    ...overrides,
  };
}

describe('useLoadMoreOnScroll', () => {
  test('does nothing while far from the bottom', async () => {
    const target = makeTarget();
    const { result } = await renderHook(() => useLoadMoreOnScroll([target]));

    result.current(scrollEvent(1000));

    expect(target.fetchNextPage).not.toHaveBeenCalled();
  });

  test('fetches the next page once within the trigger distance of the bottom', async () => {
    const target = makeTarget();
    const { result } = await renderHook(() => useLoadMoreOnScroll([target]));

    result.current(scrollEvent(100));

    expect(target.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('does not fetch again while a fetch is already in flight', async () => {
    const target = makeTarget({ isFetchingNextPage: true });
    const { result } = await renderHook(() => useLoadMoreOnScroll([target]));

    result.current(scrollEvent(0));

    expect(target.fetchNextPage).not.toHaveBeenCalled();
  });

  test('does not fetch once there is no next page', async () => {
    const target = makeTarget({ hasNextPage: false });
    const { result } = await renderHook(() => useLoadMoreOnScroll([target]));

    result.current(scrollEvent(0));

    expect(target.fetchNextPage).not.toHaveBeenCalled();
  });

  test('fetches each eligible target independently when several share one scroll view', async () => {
    const ready = makeTarget();
    const fetching = makeTarget({ isFetchingNextPage: true });
    const exhausted = makeTarget({ hasNextPage: false });
    const { result } = await renderHook(() =>
      useLoadMoreOnScroll([ready, fetching, exhausted]),
    );

    result.current(scrollEvent(0));

    expect(ready.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(fetching.fetchNextPage).not.toHaveBeenCalled();
    expect(exhausted.fetchNextPage).not.toHaveBeenCalled();
  });
});
