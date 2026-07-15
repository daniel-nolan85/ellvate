import type { AssistantChatMessage } from './types';

export const MAX_MESSAGE_TEXT_LENGTH = 2000;
export const MAX_MESSAGES = 50;
export const MAX_TOTAL_MESSAGE_TEXT_LENGTH = 12_000;

const isValidMessage = (value: unknown): value is AssistantChatMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { readonly role?: unknown; readonly text?: unknown };
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.text === 'string' &&
    candidate.text.length <= MAX_MESSAGE_TEXT_LENGTH
  );
};

export function validateChatMessages(
  input: unknown,
): readonly AssistantChatMessage[] | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const { messages } = input as { readonly messages?: unknown };

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES
  ) {
    return null;
  }
  if (!messages.every(isValidMessage)) {
    return null;
  }

  const totalTextLength = messages.reduce(
    (total, message) => total + message.text.length,
    0,
  );
  if (totalTextLength > MAX_TOTAL_MESSAGE_TEXT_LENGTH) {
    return null;
  }

  return messages.map((message) => ({
    role: message.role,
    text: message.text,
  }));
}
