import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Client-only preference, not a server one — mirrors the AsyncStorage +
// `@llv:<feature>-v1` key convention already used for onboarding completion
// (src/modules/onboarding/use-onboarding-state.ts). Backed by React Query
// (staleTime: Infinity) rather than a plain useState+useEffect so every
// PostCard/detail-screen instance shares one cached read instead of each
// hitting AsyncStorage on its own mount.
const PIN_EXPLAINER_DISMISSED_KEY = '@llv:pin-explainer-dismissed-v1';
const queryKey = ['pin-explainer-dismissed'] as const;

export function usePinExplainerDismissed() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryFn: async () =>
      (await AsyncStorage.getItem(PIN_EXPLAINER_DISMISSED_KEY)) === 'true',
    queryKey,
    staleTime: Infinity,
  });

  const dismissForever = async () => {
    await AsyncStorage.setItem(PIN_EXPLAINER_DISMISSED_KEY, 'true');
    queryClient.setQueryData(queryKey, true);
  };

  // Defaults to "not dismissed" while the AsyncStorage read is in flight —
  // worst case the explainer shows once more than strictly needed, which is
  // harmless, versus silently skipping it looking like a bug.
  return { dismissed: query.data ?? false, dismissForever };
}
