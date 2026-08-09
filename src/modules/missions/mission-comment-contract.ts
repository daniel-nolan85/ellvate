export interface MissionCommentAuthor {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface MissionComment {
  readonly id: string;
  readonly missionId: string;
  readonly author: MissionCommentAuthor;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface MissionCommentsResponse {
  readonly comments: readonly MissionComment[];
}

export interface MissionCommentsPageResponse {
  readonly comments: readonly MissionComment[];
  readonly nextCursor: string | null;
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

const parseComment = (value: unknown, index: number): MissionComment => {
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
    editedAt:
      typeof comment.editedAt === 'string' ? comment.editedAt : null,
    id: requiredString(comment, 'id', `comments[${index}]`),
    missionId: requiredString(comment, 'missionId', `comments[${index}]`),
  };
};

export function parseMissionCommentsResponse(
  value: unknown,
): MissionCommentsResponse {
  const response = asRecord(value);
  if (!response || !Array.isArray(response.comments)) {
    throw new Error('Invalid comments response: comments must be an array.');
  }

  return { comments: response.comments.map(parseComment) };
}

export function parseMissionCommentsPageResponse(
  value: unknown,
): MissionCommentsPageResponse {
  const response = asRecord(value);
  if (!response || !Array.isArray(response.comments)) {
    throw new Error('Invalid comments response: comments must be an array.');
  }
  const nextCursor = response.nextCursor;
  if (nextCursor !== null && typeof nextCursor !== 'string') {
    throw new Error('Invalid comments response: nextCursor must be a string or null.');
  }

  return {
    comments: response.comments.map(parseComment),
    nextCursor,
  };
}
