import { fireEvent, render } from '@testing-library/react-native';
import { AuthStep } from './auth-step';
import { SessionContextProvider, disabledSession } from '@/src/platform/session';

jest.mock('@/src/modules/authentication', () => ({
  AuthenticationStateScreen: () => null,
  SignInScreen: () => null,
}));

describe('AuthStep', () => {
  test('renders a safe demo continuation without mounting Clerk hooks', async () => {
    const onNext = jest.fn();

    const { getByText, getByTestId } = await render(
      <SessionContextProvider value={disabledSession}>
        <AuthStep onBack={jest.fn()} onNext={onNext} />
      </SessionContextProvider>,
    );

    expect(getByText('Authentication is disabled')).toBeTruthy();
    await fireEvent.press(getByTestId('auth-demo-continue'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
