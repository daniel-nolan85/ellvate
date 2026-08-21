import type { RequestContext } from '@/src/backend/http';
import { getState, setState, type ContactMessageCategory } from '@/src/backend/store';

import { submitContactMessageSupabase } from './contact-supabase';
import { CONTACT_CATEGORIES, type SubmitContactMessageResult } from './types';

const MAX_MESSAGE_LENGTH = 2000;

function isValidCategory(value: unknown): value is ContactMessageCategory {
  return (
    typeof value === 'string' &&
    (CONTACT_CATEGORIES as readonly string[]).includes(value)
  );
}

function validate(
  category: unknown,
  message: unknown,
): { readonly category: ContactMessageCategory; readonly message: string } | SubmitContactMessageResult {
  if (!isValidCategory(category)) {
    return { code: 'invalid_category', message: 'Choose a category.', ok: false };
  }
  const trimmed = typeof message === 'string' ? message.trim() : '';
  if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      code: 'invalid_message',
      message: `Message must be between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
      ok: false,
    };
  }
  return { category, message: trimmed };
}

function submitContactMessageMemory(
  userId: string,
  category: ContactMessageCategory,
  message: string,
): SubmitContactMessageResult {
  const id = `contact-${crypto.randomUUID()}`;
  setState((current) => ({
    ...current,
    contactMessages: [
      ...current.contactMessages,
      { category, createdAt: new Date().toISOString(), id, message, userId },
    ],
  }));
  return { id, ok: true };
}

export async function submitContactMessage(
  ctx: RequestContext,
  category: unknown,
  message: unknown,
): Promise<SubmitContactMessageResult> {
  const validated = validate(category, message);
  if ('ok' in validated) {
    return validated;
  }
  return ctx.supabase
    ? submitContactMessageSupabase(ctx.supabase, ctx.userId, validated.category, validated.message)
    : submitContactMessageMemory(ctx.userId, validated.category, validated.message);
}

// Exposed for tests that want to assert on stored state directly.
export function listContactMessagesMemory(): readonly {
  readonly id: string;
  readonly userId: string;
  readonly category: ContactMessageCategory;
  readonly message: string;
  readonly createdAt: string;
}[] {
  return getState().contactMessages;
}
