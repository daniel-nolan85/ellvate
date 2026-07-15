import { act, renderHook } from '@testing-library/react-native';

import { useAuth, useSignIn, useSignUp } from '@clerk/expo';

import { useIdentifierAuthFlow } from './use-identifier-auth-flow';

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
    emailCode: {
      sendCode: jest.fn(),
      verifyCode: jest.fn(),
    },
    finalize: jest.fn(),
    phoneCode: {
      sendCode: jest.fn(),
      verifyCode: jest.fn(),
    },
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

describe('useIdentifierAuthFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('starts email sign-up when Clerk throws identifier-not-found', async () => {
    const { signIn, signUp } = createClerkMocks();
    signIn.create.mockRejectedValueOnce({
      errors: [{ code: 'form_identifier_not_found' }],
    });
    signUp.create.mockResolvedValueOnce({ error: undefined });
    signUp.verifications.sendEmailCode.mockResolvedValueOnce({ error: undefined });

    const { result } = await renderHook(() => useIdentifierAuthFlow());

    await act(async () => {
      result.current.chooseKind('email');
    });
    await act(async () => {
      await result.current.submitIdentifier('new-user@example.invalid');
    });

    expect(signUp.create).toHaveBeenCalledWith({
      emailAddress: 'new-user@example.invalid',
    });
    expect(signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
    expect(result.current.mode).toBe('signUp');
    expect(result.current.step).toBe('code');
  });

  test('does not start sign-up for a thrown network error', async () => {
    const { signIn, signUp } = createClerkMocks();
    signIn.create.mockRejectedValueOnce({
      code: 'network_error',
      message: 'Network unavailable.',
    });

    const { result } = await renderHook(() => useIdentifierAuthFlow());

    await act(async () => {
      await result.current.submitIdentifier('+12025550142');
    });

    expect(signUp.create).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Network unavailable.');
    expect(result.current.step).toBe('identifier');
  });
});
