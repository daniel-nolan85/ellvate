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

  test('invalidates the profile, forum, and leaderboard queries once onboarding completes', async () => {
    mockedRequestJson.mockResolvedValueOnce(undefined);
    const queryClient = new QueryClient();
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
            replies: true,
          },
          role: 'resident',
        },
        method: 'PUT',
        path: '/api/me/profile',
      }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['forum'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['leaderboard'] });
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
