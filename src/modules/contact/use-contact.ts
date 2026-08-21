import { useMutation } from '@tanstack/react-query';

import { requestJson } from '@/src/services/api';
import { useSession } from '@/src/platform/session';

export type ContactCategory = 'bug' | 'feedback' | 'question' | 'other';

interface SubmitContactMessageInput {
  readonly category: ContactCategory;
  readonly message: string;
}

export function useSubmitContactMessage() {
  const session = useSession();

  return useMutation({
    mutationFn: (input: SubmitContactMessageInput) =>
      requestJson<{ readonly id: string }>({
        body: input,
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/contact',
      }),
  });
}
