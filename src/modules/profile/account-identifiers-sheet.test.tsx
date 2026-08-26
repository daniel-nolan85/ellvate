import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { useUser } from '@clerk/expo';

import { AccountIdentifiersSheet } from './account-identifiers-sheet';

// Sheet reads useSafeAreaInsets() directly (no SafeAreaProvider mounted by
// the app root in this test), so one is supplied here with a fixed, zeroed
// frame/insets -- there's no real device to measure.
const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const renderSheet = (props: Parameters<typeof AccountIdentifiersSheet>[0]) =>
  render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <AccountIdentifiersSheet {...props} />
    </SafeAreaProvider>,
  );

jest.mock('@clerk/expo', () => ({
  useUser: jest.fn(),
}));

const mockedUseUser = jest.mocked(useUser);

const createResource = (id: string) => ({
  attemptVerification: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  id,
  prepareVerification: jest.fn().mockResolvedValue(undefined),
});

describe('AccountIdentifiersSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lists the current email, and tapping the row opens the right form', async () => {
    const created = createResource('new-email-id');
    const user = {
      createEmailAddress: jest.fn().mockResolvedValue(created),
      createPhoneNumber: jest.fn(),
      emailAddresses: [],
      phoneNumbers: [],
      primaryEmailAddress: null,
      primaryPhoneNumber: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockedUseUser.mockReturnValue({ user } as unknown as ReturnType<typeof useUser>);

    const view = await renderSheet({
      onClose: jest.fn(),
      onUpdated: jest.fn(),
      visible: true,
    });

    expect(view.getByText('Not set')).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId('account-identifier-email-row'));
    });
    expect(view.getByText('Add an email')).toBeTruthy();
  });

  test('submitting a new email advances to the code step and starts verification', async () => {
    const created = createResource('new-email-id');
    const user = {
      createEmailAddress: jest.fn().mockResolvedValue(created),
      createPhoneNumber: jest.fn(),
      emailAddresses: [],
      phoneNumbers: [],
      primaryEmailAddress: null,
      primaryPhoneNumber: null,
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockedUseUser.mockReturnValue({ user } as unknown as ReturnType<typeof useUser>);

    const view = await renderSheet({
      onClose: jest.fn(),
      onUpdated: jest.fn(),
      visible: true,
    });

    await act(async () => {
      fireEvent.press(view.getByTestId('account-identifier-email-row'));
    });
    await act(async () => {
      fireEvent.changeText(
        view.getByTestId('identifier-update-email-input'),
        'new@example.invalid',
      );
    });
    await act(async () => {
      fireEvent.press(view.getByText('Send code'));
    });

    expect(user.createEmailAddress).toHaveBeenCalledWith({ email: 'new@example.invalid' });
    expect(created.prepareVerification).toHaveBeenCalledWith({ strategy: 'email_code' });
    expect(view.getByText('Enter the code')).toBeTruthy();
  });
});
