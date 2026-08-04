module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|react-native-reanimated|react-native-worklets|react-native-gesture-handler|react-native-svg|@react-native|@react-native-community|react-native-url-polyfill|react-native-css-interop|expo|expo-[a-z-]+|@expo|@expo-google-fonts|@gluestack-ui|nativewind|@clerk|react-navigation|@react-navigation|lucide-react-native)/)',
    'node_modules/react-native-reanimated/plugin/',
  ],
  testMatch: [
    '<rootDir>/tests/components/**/*.test.tsx',
    '<rootDir>/src/modules/**/*.test.tsx',
    '<rootDir>/src/components/**/*.test.tsx',
  ],
};
