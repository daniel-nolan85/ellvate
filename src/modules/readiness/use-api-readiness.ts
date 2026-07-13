import { useQuery } from '@tanstack/react-query';

import { publicEnvironment } from '@/src/platform/environment';
import { requestJson } from '@/src/services/api';

export function useApiReadiness() {
  return useQuery({
    enabled: Boolean(publicEnvironment.apiUrl),
    meta: {
      persist: true,
      sensitive: false,
    },
    queryFn: ({ signal }) => requestJson<unknown>({
      path: '/health',
      signal,
    }),
    queryKey: [
      'readiness',
      'api',
      publicEnvironment.apiUrl ?? 'not-configured',
    ],
  });
}
