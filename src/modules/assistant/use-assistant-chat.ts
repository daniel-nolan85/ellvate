import { useCallback, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { requestJson } from '@/src/services/api';

export interface AssistantToolCall {
  readonly tool: 'search_events' | 'search_missions' | 'search_posts';
  readonly label: string;
}

export interface AssistantChatMessage {
  readonly role: 'user' | 'assistant';
  readonly text: string;
}

export interface AssistantReply {
  readonly reply: string;
  readonly toolCalls: readonly AssistantToolCall[];
}

export type ChatEntry =
  | { readonly kind: 'user' | 'assistant'; readonly text: string }
  | { readonly kind: 'tool'; readonly tool: string; readonly label: string };

const SEED_ENTRIES: readonly ChatEntry[] = [
  { kind: 'user', text: 'Any networking events this weekend?' },
  { kind: 'tool', label: 'Searching events…', tool: 'search_events' },
  {
    kind: 'assistant',
    text: 'Two coming up: the Locals Networking Mixer (Fri 6:30 PM, MonteLago Village) and Small Business Coffee & Connect (Wed 8 AM). Want me to add the mixer to your calendar?',
  },
];

const SUGGESTIONS: readonly string[] = [
  'Events this weekend',
  'Missions near me',
  'Top posts today',
];

const APOLOGY_TEXT =
  'Sorry — I could not reach the assistant just now. Please try again in a moment.';

const toMessages = (
  entries: readonly ChatEntry[],
): readonly AssistantChatMessage[] =>
  entries.flatMap((entry) =>
    entry.kind === 'tool' ? [] : [{ role: entry.kind, text: entry.text }],
  );

export function useAssistantChat() {
  const session = useSession();
  const [entries, setEntries] = useState<readonly ChatEntry[]>(SEED_ENTRIES);
  // Synchronous guard: isPending is React state and lags within a single tick,
  // so two taps in the same frame could both pass the check and double-send.
  const inFlightRef = useRef(false);

  const appendEntries = useCallback((next: readonly ChatEntry[]) => {
    setEntries((previous) => [...previous, ...next]);
  }, []);

  const mutation = useMutation({
    mutationFn: (messages: readonly AssistantChatMessage[]) =>
      requestJson<AssistantReply>({
        body: { messages },
        getAccessToken: session.getToken,
        method: 'POST',
        path: '/api/assistant/chat',
      }),
    mutationKey: ['assistant', 'chat', session.userId ?? 'demo-user'],
    onError: () => {
      appendEntries([{ kind: 'assistant', text: APOLOGY_TEXT }]);
    },
    onSuccess: (reply) => {
      appendEntries([
        ...reply.toolCalls.map(
          (call): ChatEntry => ({
            kind: 'tool',
            label: call.label,
            tool: call.tool,
          }),
        ),
        { kind: 'assistant', text: reply.reply },
      ]);
    },
    onSettled: () => {
      inFlightRef.current = false;
    },
  });

  const { isPending, mutate } = mutation;

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      const history = toMessages(entries);
      setEntries((previous) => [...previous, { kind: 'user', text: trimmed }]);
      mutate([...history, { role: 'user', text: trimmed }]);
    },
    [entries, mutate],
  );

  return {
    entries,
    isSending: isPending,
    sendMessage,
    suggestions: SUGGESTIONS,
  };
}
