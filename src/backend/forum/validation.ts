export interface ValidatedPost {
  readonly forum: string;
  readonly title: string;
  readonly excerpt: string;
}

export type PostValidation =
  | { readonly ok: true; readonly value: ValidatedPost }
  | { readonly ok: false; readonly code: 'invalid_post'; readonly message: string };

const MAX_TITLE_LENGTH = 140;
const MAX_EXCERPT_LENGTH = 600;
const MAX_FORUM_LENGTH = 60;

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function validatePostInput(
  input: unknown,
  knownForums: readonly string[],
): PostValidation {
  const raw =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  const forum = asTrimmedString(raw.forum);
  const title = asTrimmedString(raw.title);
  const excerpt = asTrimmedString(raw.excerpt);

  if (!forum || !title) {
    return {
      code: 'invalid_post',
      message: 'A non-empty forum and title are required.',
      ok: false,
    };
  }
  if (
    forum.length > MAX_FORUM_LENGTH ||
    title.length > MAX_TITLE_LENGTH ||
    excerpt.length > MAX_EXCERPT_LENGTH
  ) {
    return {
      code: 'invalid_post',
      message: 'A post field exceeds its maximum length.',
      ok: false,
    };
  }
  if (forum !== 'All' && !knownForums.includes(forum)) {
    return { code: 'invalid_post', message: 'Unknown forum.', ok: false };
  }

  return { ok: true, value: { excerpt, forum, title } };
}
