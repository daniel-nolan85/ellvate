const MAX_BODY_LENGTH = 2000;

export type BodyValidation =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly message: string };

export function validateCommentBody(input: unknown): BodyValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const body = typeof raw.body === 'string' ? raw.body.trim() : '';

  if (!body) {
    return { message: 'A non-empty comment body is required.', ok: false };
  }
  if (body.length > MAX_BODY_LENGTH) {
    return { message: 'The comment is too long.', ok: false };
  }
  return { body, ok: true };
}
