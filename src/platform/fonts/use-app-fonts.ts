import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';

export interface AppFontsState {
  readonly error: Error | null;
  readonly loaded: boolean;
}

// DuneRise is only used by the Nolancode screen of the boot splash sequence
// (see ../splash), but it's loaded here alongside the rest so there is a
// single font-readiness gate instead of a second useFonts() call racing this
// one.
export const useAppFonts = (): AppFontsState => {
  const [loaded, error] = useFonts({
    DuneRise: require('../../../assets/fonts/Dune_Rise.otf'),
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  return { error: error ?? null, loaded };
};
