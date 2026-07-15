export interface CommentAuthor {
  readonly id: string;
  readonly name: string;
}

export interface ForumComment {
  readonly id: string;
  readonly postId: string;
  readonly author: CommentAuthor;
  readonly body: string;
  readonly createdAt: string;
}

export interface CommentsResponse {
  readonly comments: readonly ForumComment[];
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

const parseComment = (value: unknown, index: number): ForumComment => {
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
      id: requiredString(author, 'id', `comments[${index}].author`),
      name: requiredString(author, 'name', `comments[${index}].author`),
    },
    body: requiredString(comment, 'body', `comments[${index}]`),
    createdAt: requiredString(comment, 'createdAt', `comments[${index}]`),
    id: requiredString(comment, 'id', `comments[${index}]`),
    postId: requiredString(comment, 'postId', `comments[${index}]`),
  };
};

export function parseCommentsResponse(value: unknown): CommentsResponse {
  const response = asRecord(value);
  if (!response || !Array.isArray(response.comments)) {
    throw new Error('Invalid comments response: comments must be an array.');
  }

  return { comments: response.comments.map(parseComment) };
}
