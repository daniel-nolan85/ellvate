export type FontWeightToken = 400 | 500 | 600 | 700;

export const fontFamilyByWeight: Readonly<Record<FontWeightToken, string>> =
  Object.freeze({
    400: 'Inter_400Regular',
    500: 'Inter_500Medium',
    600: 'Inter_600SemiBold',
    700: 'Inter_700Bold',
  });
