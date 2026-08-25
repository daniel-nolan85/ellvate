import { act, renderHook } from '@testing-library/react-native';

import { useUser } from '@clerk/expo';

import { useIdentifierUpdate } from './use-identifier-update';

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

const createUserMock = (options?: {
  readonly existingEmail?: ReturnType<typeof createResource>;
  readonly existingPhone?: ReturnType<typeof createResource>;
}) => {
  const created = createResource('new-resource-id');
  const user = {
    createEmailAddress: jest.fn().mockResolvedValue(created),
    createPhoneNumber: jest.fn().mockResolvedValue(created),
    emailAddresses: options?.existingEmail ? [options.existingEmail] : [],
    phoneNumbers: options?.existingPhone ? [options.existingPhone] : [],
    update: jest.fn().mockResolvedValue(undefined),
  };

  mockedUseUser.mockReturnValue({ user } as unknown as ReturnType<typeof useUser>);

  return { created, user };
};

describe('useIdentifierUpdate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('adding a first email creates, verifies, sets primary, and destroys nothing', async () => {
    const { created, user } = createUserMock();
    const { result } = await renderHook(() => useIdentifierUpdate('email'));

    await act(async () => {
      await result.current.submitValue('new@example.invalid');
    });

    expect(user.createEmailAddress).toHaveBeenCalledWith({ email: 'new@example.invalid' });
    expect(created.prepareVerification).toHaveBeenCalledWith({ strategy: 'email_code' });
    expect(result.current.step).toBe('code');

    await act(async () => {
      await result.current.submitCode('123456');
    });

    expect(created.attemptVerification).toHaveBeenCalledWith({ code: '123456' });
    expect(user.update).toHaveBeenCalledWith({ primaryEmailAddressId: 'new-resource-id' });
    expect(created.destroy).not.toHaveBeenCalled();
    expect(result.current.step).toBe('value');
  });

  test('replacing an existing phone number verifies the new one before destroying the old one', async () => {
    const existingPhone = createResource('old-phone-id');
    const { created, user } = createUserMock({ existingPhone });
    const { result } = await renderHook(() => useIdentifierUpdate('phone'));

    await act(async () => {
      await result.current.submitValue('+12025550142');
    });

    expect(user.createPhoneNumber).toHaveBeenCalledWith({ phoneNumber: '+12025550142' });

    await act(async () => {
      await result.current.submitCode('123456');
    });

    // Verify-then-revoke: the new number is confirmed and made primary
    // before the old one is ever destroyed, so a failed verification never
    // strands the account without a working sign-in number.
    expect(created.attemptVerification).toHaveBeenCalledWith({ code: '123456' });
    expect(user.update).toHaveBeenCalledWith({ primaryPhoneNumberId: 'new-resource-id' });
    expect(existingPhone.destroy).toHaveBeenCalledTimes(1);
  });

  test('a failed verification code surfaces an error and never touches the old identifier', async () => {
    const existingEmail = createResource('old-email-id');
    const { created, user } = createUserMock({ existingEmail });
    created.attemptVerification.mockRejectedValueOnce(new Error('bad code'));
    const { result } = await renderHook(() => useIdentifierUpdate('email'));

    await act(async () => {
      await result.current.submitValue('new@example.invalid');
    });
    await act(async () => {
      const ok = await result.current.submitCode('000000');
      expect(ok).toBe(false);
    });

    expect(result.current.error).toBe('That code did not match. Check it and try again.');
    expect(user.update).not.toHaveBeenCalled();
    expect(existingEmail.destroy).not.toHaveBeenCalled();
  });

  test('resend prepares verification again on the pending resource', async () => {
    const { created } = createUserMock();
    const { result } = await renderHook(() => useIdentifierUpdate('phone'));

    await act(async () => {
      await result.current.submitValue('+12025550142');
    });
    created.prepareVerification.mockClear();

    await act(async () => {
      await result.current.resend();
    });

    expect(created.prepareVerification).toHaveBeenCalledWith({ strategy: 'phone_code' });
  });

  test('reset clears the pending resource and returns to the value step', async () => {
    createUserMock();
    const { result } = await renderHook(() => useIdentifierUpdate('email'));

    await act(async () => {
      await result.current.submitValue('new@example.invalid');
    });
    expect(result.current.step).toBe('code');

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.step).toBe('value');
    expect(result.current.error).toBeNull();
  });
});
