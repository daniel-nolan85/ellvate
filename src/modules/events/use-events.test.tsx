import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  SessionContextProvider,
  disabledSession,
} from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import type { CommunityEvent } from './events-types';
import { useToggleInterested, useToggleJoin } from './use-events';

jest.mock('@/src/services/api', () => ({
  requestJson: jest.fn(),
}));

const mockedRequestJson = jest.mocked(requestJson);

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionContextProvider value={disabledSession}>
          {children}
        </SessionContextProvider>
      </QueryClientProvider>
    );
  };
}

const EVENT_ID = 'event-1';
const DETAIL_KEY = ['events', 'view', 'demo-user', 'detail', EVENT_ID];

const baseEvent: CommunityEvent = {
  attendees: [],
  author: { avatarUrl: null, id: 'author-1', isAdmin: false, name: 'Author' },
  cost: null,
  dateLabel: 'Jan 1',
  dayLabel: 'Thursday',
  editedAt: null,
  endsAt: null,
  endTimeLabel: null,
  featured: false,
  going: 3,
  id: EVENT_ID,
  interested: false,
  interestedCount: 1,
  joined: false,
  place: 'The Pub',
  startsAt: '2026-01-01T18:00:00.000Z',
  tag: 'social',
  timeLabel: '6:00 PM',
  title: 'Trivia Night',
};

// Regression tests: the event detail screen's own useEvent query is cached
// under ['events','view',userId,'detail',eventId] -- a key that starts with
// the exact same prefix (['events','view',userId]) these mutations use to
// patch every cached list page on tap. A plain `{ queryKey: listPrefix }`
// filter prefix-matches the detail entry too, whose cached value is
// `{ event }` rather than `{ pages: [...] }`, so the patch crashed on
// `current.pages.map` every time the detail screen (where both buttons
// live) had already fetched the event -- i.e. every time you'd actually tap
// either button there.
describe('useToggleJoin / useToggleInterested', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('toggling Join does not crash when the event detail query is cached', async () => {
    mockedRequestJson.mockResolvedValueOnce({
      going: 4,
      id: EVENT_ID,
      joined: true,
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(DETAIL_KEY, { event: baseEvent });

    const { result } = await renderHook(() => useToggleJoin(), {
      wrapper: createWrapper(queryClient),
    });

    let succeeded = false;
    await act(async () => {
      try {
        await result.current.mutateAsync(EVENT_ID);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    });

    expect(succeeded).toBe(true);
    expect(
      queryClient.getQueryData<{ readonly event: CommunityEvent }>(DETAIL_KEY)
        ?.event.joined,
    ).toBe(true);
  });

  test('toggling Interested does not crash when the event detail query is cached', async () => {
    mockedRequestJson.mockResolvedValueOnce({
      id: EVENT_ID,
      interested: true,
      interestedCount: 2,
    });
    const queryClient = new QueryClient();
    queryClient.setQueryData(DETAIL_KEY, { event: baseEvent });

    const { result } = await renderHook(() => useToggleInterested(), {
      wrapper: createWrapper(queryClient),
    });

    let succeeded = false;
    await act(async () => {
      try {
        await result.current.mutateAsync(EVENT_ID);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    });

    expect(succeeded).toBe(true);
    expect(
      queryClient.getQueryData<{ readonly event: CommunityEvent }>(DETAIL_KEY)
        ?.event.interested,
    ).toBe(true);
  });
});
