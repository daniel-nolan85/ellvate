import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';

export interface AppFontsState {
  readonly error: Error | null;
  readonly loaded: boolean;
}

export const useAppFonts = (): AppFontsState => {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return { error: error ?? null, loaded };
};
