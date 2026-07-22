export interface EventCommentAuthor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface EventComment {
  readonly id: string;
  readonly eventId: string;
  readonly author: EventCommentAuthor;
  readonly body: string;
  readonly createdAt: string;
}

export interface EventCommentsResponse {
  readonly comments: readonly EventComment[];
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === 'object' && value !== null
    ? (value as UnknownRecord)
    : null;

const requiredString = (
  record: UnknownRecord,
  key: string,
  context: string,
): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid comments response: ${context}.${key} is missing.`);
  }
  return value;
};

const parseComment = (value: unknown, index: number): EventComment => {
  const comment = asRecord(value);
  if (!comment) {
    throw new Error(`Invalid comments response: comments[${index}] is not an object.`);
  }

  const author = asRecord(comment.author);
  if (!author) {
    throw new Error(
      `Invalid comments response: comments[${index}].author is missing.`,
    );
  }

  return {
    author: {
      avatarUrl:
        typeof author.avatarUrl === 'string' ? author.avatarUrl : null,
      id: requiredString(author, 'id', `comments[${index}].author`),
      name: requiredString(author, 'name', `comments[${index}].author`),
    },
    body: requiredString(comment, 'body', `comments[${index}]`),
    createdAt: requiredString(comment, 'createdAt', `comments[${index}]`),
    eventId: requiredString(comment, 'eventId', `comments[${index}]`),
    id: requiredString(comment, 'id', `comments[${index}]`),
  };
};

export function parseEventCommentsResponse(value: unknown): EventCommentsResponse {
  const response = asRecord(value);
  if (!response || !Array.isArray(response.comments)) {
    throw new Error('Invalid comments response: comments must be an array.');
  }

  return { comments: response.comments.map(parseComment) };
}
