export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface EventComment {
  readonly id: string;
  readonly eventId: string;
  readonly author: PersonRef;
  readonly body: string;
  readonly createdAt: string;
}

export type CreateEventCommentResult =
  | { readonly ok: true; readonly comment: EventComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'event_not_found';
      readonly message: string;
    };
