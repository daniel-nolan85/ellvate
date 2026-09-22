import { useCallback, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { useSession } from '@/src/platform/session';
import { ApiError, requestJson } from '@/src/services/api';
import { reportError } from '@/src/services/crash-reporting';

export interface AssistantToolCall {
  readonly tool: 'search_events' | 'search_missions' | 'search_posts' | 'search_services';
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

export interface ChatEntry {
  readonly kind: 'user' | 'assistant';
  readonly text: string;
}

// The assistant starts as a blank slate — no fabricated conversation. The screen
// shows a greeting and suggestion chips until the user sends the first message.
const INITIAL_ENTRIES: readonly ChatEntry[] = [];

const SUGGESTIONS: readonly string[] = [
  'Events this weekend',
  'Missions near me',
  'Top posts today',
];

const APOLOGY_TEXT =
  'Sorry — I could not reach the assistant just now. Please try again in a moment.';

// The generic apology above used to be the ONLY thing shown for every
// failure -- a real backend error (bad config, rate limiting) looked
// identical to a plain network blip, with no way to tell them apart short
// of digging through deployment logs. Showing the server's own message
// (when this was a real HTTP response, not a network-level failure) plus
// the code/status makes the failure self-diagnosing straight from the
// screen.
const describeFailure = (error: unknown): string =>
  error instanceof ApiError
    ? `${error.message} (${error.code ?? 'unknown'} · ${error.status})`
    : APOLOGY_TEXT;

const toMessages = (
  entries: readonly ChatEntry[],
): readonly AssistantChatMessage[] =>
  entries.map((entry) => ({ role: entry.kind, text: entry.text }));

export function useAssistantChat() {
  const session = useSession();
  const [entries, setEntries] = useState<readonly ChatEntry[]>(INITIAL_ENTRIES);
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
    onError: (error) => {
      reportError(error, { source: 'assistant-chat' });
      appendEntries([{ kind: 'assistant', text: describeFailure(error) }]);
    },
    onSuccess: (reply) => {
      // The tool-call labels (e.g. "Searching events…") only matter while the
      // reply is in flight — see ThinkingIndicator. Once the reply lands, it
      // fully replaces that indicator; the transcript never keeps a separate
      // permanent "Searching X" line lingering above the answer.
      appendEntries([{ kind: 'assistant', text: reply.reply }]);
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
