import { act, fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

import { SignInScreen } from './sign-in-screen';

// Gives the consent sheet's Terms/Privacy links a real URL to open, so the
// regression test below (they used to be swallowed by the checkbox's own
// Pressable and never fire at all) can assert the actual call.
jest.mock('@/src/platform/environment', () => ({
  publicEnvironment: { marketingUrl: 'https://example.com' },
}));

// SignInScreen reads useSafeAreaInsets() directly (no SafeAreaProvider
// mounted by the app root in this test), so one is supplied here with a
// fixed, zeroed frame/insets -- there's no real device to measure.
const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderSignInScreen = (props: Parameters<typeof SignInScreen>[0]) =>
  render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <SignInScreen {...props} />
    </SafeAreaProvider>,
  );

jest.mock('@clerk/expo', () => ({
  useAuth: jest.fn(),
  useSignIn: jest.fn(),
  useSignUp: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const mockedUseSignIn = jest.mocked(useSignIn);
const mockedUseSignUp = jest.mocked(useSignUp);

const createClerkMocks = () => {
  const signIn = {
    create: jest.fn(),
    emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
    finalize: jest.fn(),
    phoneCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  };
  const signUp = {
    create: jest.fn(),
    finalize: jest.fn(),
    verifications: {
      sendEmailCode: jest.fn(),
      sendPhoneCode: jest.fn(),
      verifyEmailCode: jest.fn(),
      verifyPhoneCode: jest.fn(),
    },
  };

  mockedUseAuth.mockReturnValue({ isLoaded: true } as ReturnType<typeof useAuth>);
  mockedUseSignIn.mockReturnValue({ signIn } as unknown as ReturnType<typeof useSignIn>);
  mockedUseSignUp.mockReturnValue({ signUp } as unknown as ReturnType<typeof useSignUp>);

  return { signIn, signUp };
};

// Types a new-user email into the identifier field and presses Continue,
// landing on the consent sheet -- signIn.create rejecting with a
// not-found error is what use-identifier-auth-flow.ts treats as "this is a
// sign-up", per its own tests.
const reachConsentStep = async (
  view: Awaited<ReturnType<typeof render>>,
  signIn: ReturnType<typeof createClerkMocks>['signIn'],
) => {
  signIn.create.mockRejectedValueOnce({
    errors: [{ code: 'form_identifier_not_found' }],
  });

  await act(async () => {
    fireEvent.changeText(view.getByTestId('auth-identifier-input'), 'new-user@example.invalid');
  });
  await act(async () => {
    fireEvent.press(view.getByText('Continue'));
  });
};

describe('SignInScreen consent step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows the consent sheet for a new sign-up, and Agree is inert until the checkbox is checked', async () => {
    const { signIn, signUp } = createClerkMocks();
    const view = await renderSignInScreen({ onAuthenticated: jest.fn() });

    await reachConsentStep(view, signIn);
    expect(view.getByText('Before you join')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByText('Agree & continue'));
    });

    expect(signUp.create).not.toHaveBeenCalled();
  });

  test('the consent sheet cannot be dismissed by tapping the backdrop', async () => {
    const { signIn } = createClerkMocks();
    const view = await renderSignInScreen({ onAuthenticated: jest.fn() });

    await reachConsentStep(view, signIn);
    expect(view.getByText('Before you join')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Close'));
    });

    // dismissable={false} on the Sheet means the backdrop tap no-ops --
    // the consent sheet (and its checkbox) is still on screen.
    expect(view.getByText('Before you join')).toBeTruthy();
    expect(view.getByTestId('auth-consent-checkbox')).toBeTruthy();
  });

  test('checking the box and agreeing calls confirmConsent with legalAccepted and advances to the code step', async () => {
    const { signIn, signUp } = createClerkMocks();
    signUp.create.mockResolvedValueOnce({ error: undefined });
    signUp.verifications.sendEmailCode.mockResolvedValueOnce({ error: undefined });

    const view = await renderSignInScreen({ onAuthenticated: jest.fn() });

    await reachConsentStep(view, signIn);

    await act(async () => {
      fireEvent.press(view.getByTestId('auth-consent-checkbox'));
    });
    await act(async () => {
      fireEvent.press(view.getByText('Agree & continue'));
    });

    expect(signUp.create).toHaveBeenCalledWith({
      emailAddress: 'new-user@example.invalid',
      legalAccepted: true,
    });
    expect(view.getByText('Check your messages')).toBeTruthy();
  });

  test('tapping the Terms of Service link opens it without toggling the checkbox', async () => {
    const { signIn } = createClerkMocks();
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = await renderSignInScreen({ onAuthenticated: jest.fn() });

    await reachConsentStep(view, signIn);

    await act(async () => {
      fireEvent.press(view.getByText('Terms of Service'));
    });

    expect(openURL).toHaveBeenCalledWith('https://example.com/terms');
    expect(view.getByTestId('auth-consent-checkbox').props.accessibilityState.checked).toBe(
      false,
    );

    openURL.mockRestore();
  });

  test('Cancel returns to the identifier step without starting sign-up, keeping what was typed', async () => {
    const { signIn, signUp } = createClerkMocks();
    const view = await renderSignInScreen({ onAuthenticated: jest.fn() });

    await reachConsentStep(view, signIn);

    await act(async () => {
      fireEvent.press(view.getByText('Cancel'));
    });

    expect(signUp.create).not.toHaveBeenCalled();
    expect(view.getByTestId('auth-identifier-input').props.value).toBe(
      'new-user@example.invalid',
    );
  });
});
