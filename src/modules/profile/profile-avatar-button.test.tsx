import { render } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  SessionContextProvider,
  createSignedInSession,
  disabledSession,
  type AppSession,
} from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

import { ProfileAvatarButton } from './profile-avatar-button';
import type { UserProfile } from './use-profile';

jest.mock('@/src/services/api', () => ({
  requestJson: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

const mockedRequestJson = jest.mocked(requestJson);

const baseProfile: UserProfile = {
  activityVisible: false,
  avatarUrl: null,
  interests: [],
  name: 'Demo member',
  notificationPrefs: {
    digest: true,
    events: true,
    missions: true,
    petitions: true,
    replies: true,
  },
  onboardedAt: null,
  role: null,
  userId: 'demo-user',
};

async function renderButton(session: AppSession = disabledSession) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionContextProvider value={session}>
        <ProfileAvatarButton />
      </SessionContextProvider>
    </QueryClientProvider>,
  );
}

describe('ProfileAvatarButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Regression test: this button used to hardcode 'You'/'Demo member' for its
  // initials instead of reading the saved profile name, so the nav-bar avatar
  // stayed stuck on generic initials forever, even after the user set a real
  // name on the profile screen.
  test('shows initials derived from the saved profile name once it loads', async () => {
    mockedRequestJson.mockResolvedValueOnce({
      profile: { ...baseProfile, name: 'Daniel Nolan' },
    });

    const view = await renderButton();

    expect(await view.findByText('DN')).toBeTruthy();
  });

  test('falls back to a generic placeholder while the profile is still loading', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockedRequestJson.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const view = await renderButton();

    expect(view.getByText('DM')).toBeTruthy();

    // Resolve the pending request so nothing is left dangling once the test ends.
    resolveRequest({ profile: baseProfile });
  });

  // Regression test: a signed-in user whose profile hadn't loaded yet fell
  // back to the placeholder name 'You', which produced a real-looking (but
  // wrong) initial -- 'Y' -- instead of showing the loading state.
  test('shows the loading spinner, not a wrong-looking initial, while loading for a signed-in user', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    mockedRequestJson.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const session = createSignedInSession({
      getToken: async () => null,
      signOut: async () => undefined,
      userId: 'user-1',
    });

    const view = await renderButton(session);

    expect(view.getByLabelText('loading')).toBeTruthy();
    expect(view.queryByText('Y')).toBeNull();
    expect(view.queryByText('?')).toBeNull();

    // Resolve the pending request so nothing is left dangling once the test ends.
    resolveRequest({ profile: { ...baseProfile, name: 'Daniel Nolan' } });
  });
});
