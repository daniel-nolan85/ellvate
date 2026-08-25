import type { ReactNode } from 'react';
import { Pressable as MockPressable, Text as MockText } from 'react-native';

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { WelcomeBackNoticeProvider, useWelcomeBackNotice } from '@/src/platform/notices';
import {
  createSignedInSession,
  SessionContextProvider,
  signedOutSession,
} from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import { OnboardingFlow } from './onboarding-flow';

jest.mock('@/src/services/api', () => ({
  requestJson: jest.fn(),
}));

const mockedRequestJson = jest.mocked(requestJson);

// OnboardingFlow no longer owns the "Welcome back" modal itself -- it lives
// at the root layout so it can survive the navigation away from /onboarding
// (see WelcomeBackNoticeProvider). This surfaces whatever name it was shown
// with, so these tests can assert on it without re-rendering the real modal.
function WelcomeBackProbe() {
  const { name } = useWelcomeBackNotice();
  return <MockText testID="welcome-back-name">{name ?? ''}</MockText>;
}

// OnboardingFlow's own step-skip and welcome-back orchestration is what's
// under test here -- the 15 step components it renders are stubbed out
// (mirroring auth-step.test.tsx's approach for the same reason) so this
// isn't also exercising their internals. jest.mock factories can only close
// over module-scope variables named mock* (a jest-enforced convention), so
// the react-native primitives used below are imported under that prefix.
jest.mock('./welcome-step', () => ({
  WelcomeStep: ({ onNext }: { readonly onNext: () => void }) => (
    <MockPressable onPress={onNext} testID="stub-welcome" />
  ),
}));
jest.mock('./auth-step', () => ({
  AuthStep: () => <MockText testID="stub-auth">auth</MockText>,
}));
jest.mock('./chrome', () => ({
  ObHeader: () => null,
}));
jest.mock('./role-step', () => ({
  RoleStep: () => <MockText testID="stub-role">role</MockText>,
}));
jest.mock('./name-step', () => ({
  NameStep: () => <MockText testID="stub-name">name</MockText>,
}));
jest.mock('./interests-step', () => ({
  InterestsStep: () => <MockText testID="stub-interests">interests</MockText>,
}));
jest.mock('./feature-step', () => ({
  MomentStep: () => <MockText testID="stub-moment">moment</MockText>,
  MOMENTS: Array.from({ length: 8 }, (_unused, index) => ({ id: `moment-${index}` })),
}));
jest.mock('./notifications-step', () => ({
  NotificationsStep: () => <MockText testID="stub-notifications">notifications</MockText>,
}));
jest.mock('./passkey-step', () => ({
  PasskeyStep: () => <MockText testID="stub-passkey">passkey</MockText>,
}));
jest.mock('./commit-step', () => ({
  CommitStep: () => <MockText testID="stub-commit">commit</MockText>,
}));

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('OnboardingFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('a signed-out user is unaffected: welcome, then auth, without any returning-user check', async () => {
    const queryClient = new QueryClient();
    const view = await render(
      <SessionContextProvider value={signedOutSession}>
        <WelcomeBackNoticeProvider>
          <OnboardingFlow onFinished={jest.fn()} />
        </WelcomeBackNoticeProvider>
      </SessionContextProvider>,
      { wrapper: createWrapper(queryClient) },
    );

    expect(view.getByTestId('stub-welcome')).toBeTruthy();
    expect(mockedRequestJson).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(view.getByTestId('stub-welcome'));
    });

    expect(view.getByTestId('stub-auth')).toBeTruthy();
    expect(mockedRequestJson).not.toHaveBeenCalled();
  });

  test('a signed-in, already-onboarded user sees the welcome-back modal and onFinished fires after dismissing it, without role/name/interests ever rendering', async () => {
    mockedRequestJson.mockResolvedValueOnce({
      profile: { name: 'Daniel', onboardedAt: '2026-01-01T00:00:00.000Z' },
    });
    const onFinished = jest.fn();
    const session = createSignedInSession({
      getToken: async () => 'token',
      signOut: async () => undefined,
      userId: 'user-1',
    });
    const queryClient = new QueryClient();

    const view = await render(
      <SessionContextProvider value={session}>
        <WelcomeBackNoticeProvider>
          <OnboardingFlow onFinished={onFinished} />
          <WelcomeBackProbe />
        </WelcomeBackNoticeProvider>
      </SessionContextProvider>,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1);
    });
    expect(view.getByTestId('welcome-back-name').props.children).toBe('Daniel');

    expect(view.queryByTestId('stub-role')).toBeNull();
    expect(view.queryByTestId('stub-name')).toBeNull();
    expect(view.queryByTestId('stub-interests')).toBeNull();
  });

  test('a signed-in, not-yet-onboarded user lands on the role step', async () => {
    mockedRequestJson.mockResolvedValueOnce({
      profile: { name: '', onboardedAt: null },
    });
    const session = createSignedInSession({
      getToken: async () => 'token',
      signOut: async () => undefined,
      userId: 'user-2',
    });
    const queryClient = new QueryClient();

    const view = await render(
      <SessionContextProvider value={session}>
        <WelcomeBackNoticeProvider>
          <OnboardingFlow onFinished={jest.fn()} />
        </WelcomeBackNoticeProvider>
      </SessionContextProvider>,
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => {
      expect(view.getByTestId('stub-role')).toBeTruthy();
    });
  });
});
