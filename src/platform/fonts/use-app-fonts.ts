import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Fraunces_300Light_Italic } from '@expo-google-fonts/fraunces';
import { Rye_400Regular } from '@expo-google-fonts/rye';

export interface AppFontsState {
  readonly error: Error | null;
  readonly loaded: boolean;
}

// DuneRise, Rye, and Fraunces are only used by the boot splash sequence (see
// ../splash -- Rye/Fraunces for the eLLVate wordmark and tagline, DuneRise
// for the Nolancode screen), but they're loaded here alongside the rest so
// there is a single font-readiness gate instead of a second useFonts() call
// racing this one.
export const useAppFonts = (): AppFontsState => {
  const [loaded, error] = useFonts({
    DuneRise: require('../../../assets/fonts/Dune_Rise.otf'),
    Fraunces_300Light_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Rye_400Regular,
  });

  return { error: error ?? null, loaded };
};
