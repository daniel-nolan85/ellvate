jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo/fetch', () => ({
  fetch: (...args: Parameters<typeof global.fetch>) => global.fetch(...args),
}));

jest.mock('@clerk/expo', () => ({
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({
    getToken: async () => null,
    isLoaded: true,
    isSignedIn: false,
    signOut: async () => undefined,
    userId: null,
  }),
  useSignIn: () => ({
    signIn: {
      create: async () => ({ error: undefined }),
      emailCode: { attemptVerification: async () => ({}), sendCode: async () => ({}) },
      phoneCode: { attemptVerification: async () => ({}), sendCode: async () => ({}) },
    },
  }),
  useSignUp: () => ({
    signUp: {
      create: async () => ({ error: undefined }),
      verifications: {
        attemptEmailCode: async () => ({}),
        attemptPhoneCode: async () => ({}),
        sendEmailCode: async () => ({}),
        sendPhoneCode: async () => ({}),
      },
    },
  }),
  useUser: () => ({ user: null }),
}));

jest.mock('@clerk/expo/token-cache', () => ({
  tokenCache: {},
}));
