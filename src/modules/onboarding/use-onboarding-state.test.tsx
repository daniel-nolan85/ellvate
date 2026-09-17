import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionContextProvider, disabledSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import {
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboardingComplete,
  useOnboardingState,
} from './use-onboarding-state';

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

describe('onboarding-complete flag', () => {
  test('starts incomplete, flips true after marking, and clears after resetting', async () => {
    expect(await isOnboardingComplete()).toBe(false);

    await markOnboardingComplete();
    expect(await isOnboardingComplete()).toBe(true);

    await resetOnboardingComplete();
    expect(await isOnboardingComplete()).toBe(false);
  });
});

describe('useOnboardingState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes the response straight into the profile cache and invalidates forum/leaderboard once onboarding completes', async () => {
    const response = { profile: { onboardedAt: '2026-09-17T00:00:00.000Z' } };
    mockedRequestJson.mockResolvedValueOnce(response);
    const queryClient = new QueryClient();
    const setQueryDataSpy = jest.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useOnboardingState(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.setRole('resident');
      result.current.toggleInterest('Boating & marina');
      result.current.toggleInterest('Trails & fitness');
      result.current.toggleInterest('Dining out');
    });

    let completed = false;
    await act(async () => {
      completed = await result.current.completeOnboarding();
    });

    expect(completed).toBe(true);
    expect(mockedRequestJson).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          interests: ['Boating & marina', 'Trails & fitness', 'Dining out'],
          notificationPrefs: {
            digest: true,
            events: true,
            missions: true,
            petitions: true,
            replies: true,
          },
          onboardingComplete: true,
          role: 'resident',
        },
        method: 'PUT',
        path: '/api/me/profile',
      }),
    );
    // setQueryData, not invalidateQueries, for the profile key -- see
    // completeOnboarding's own WHY for why an invalidate-and-refetch loses
    // this race in practice even with refetchType: 'all'.
    expect(setQueryDataSpy).toHaveBeenCalledWith(['profile', 'me'], response);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['forum'],
      refetchType: 'all',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['leaderboard'],
      refetchType: 'all',
    });
  });

  test('includes a trimmed name in the request body when the name step was filled in', async () => {
    mockedRequestJson.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();

    const { result } = await renderHook(() => useOnboardingState(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      result.current.setName('  Daniel  ');
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    expect(mockedRequestJson).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ name: 'Daniel' }),
      }),
    );
  });

  test('omits name from the request body when the name step was skipped', async () => {
    mockedRequestJson.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();

    const { result } = await renderHook(() => useOnboardingState(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.completeOnboarding();
    });

    const [[call]] = mockedRequestJson.mock.calls;
    expect(call.body).not.toHaveProperty('name');
  });

  test('does not invalidate any query when the save fails', async () => {
    mockedRequestJson.mockRejectedValueOnce(new Error('Network down'));
    const queryClient = new QueryClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = await renderHook(() => useOnboardingState(), {
      wrapper: createWrapper(queryClient),
    });

    let completed = true;
    await act(async () => {
      completed = await result.current.completeOnboarding();
    });

    expect(completed).toBe(false);
    expect(result.current.completionError).toBe('Network down');
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
