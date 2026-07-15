import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  canAccessCommunityRoutes,
  RequireAuthentication,
} from '@/src/modules/authentication';
import {
  SessionContextProvider,
  createSignedInSession,
  loadingSession,
  signedOutSession,
} from '@/src/platform/session';

const signedInSession = createSignedInSession({
  getToken: async () => 'test-token',
  signOut: async () => undefined,
  userId: 'user-test',
});

describe('RequireAuthentication', () => {
  test('renders children for a signed-in session', async () => {
    const view = await render(
      <SessionContextProvider value={signedInSession}>
        <RequireAuthentication fallback={<Text>blocked</Text>}>
          <Text>private content</Text>
        </RequireAuthentication>
      </SessionContextProvider>,
    );

    expect(view.getByText('private content')).toBeTruthy();
  });

  test('renders the supplied fallback while signed out', async () => {
    const view = await render(
      <SessionContextProvider value={signedOutSession}>
        <RequireAuthentication fallback={<Text>sign in required</Text>}>
          <Text>private content</Text>
        </RequireAuthentication>
      </SessionContextProvider>,
    );

    expect(view.getByText('sign in required')).toBeTruthy();
  });

  test('renders the loading fallback while restoring a session', async () => {
    const view = await render(
      <SessionContextProvider value={loadingSession}>
        <RequireAuthentication loadingFallback={<Text>loading</Text>}>
          <Text>private content</Text>
        </RequireAuthentication>
      </SessionContextProvider>,
    );

    expect(view.getByText('loading')).toBeTruthy();
  });
});

describe('community route access', () => {
  test.each([
    ['signed-in', true],
    ['disabled', true],
    ['loading', false],
    ['signed-out', false],
    ['misconfigured', false],
  ] as const)('%s access is %s', (status, expected) => {
    expect(canAccessCommunityRoutes(status)).toBe(expected);
  });
});
