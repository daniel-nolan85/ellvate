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
  readonly editedAt: string | null;
}

export interface EventCommentsPage {
  readonly comments: readonly EventComment[];
  readonly nextCursor: string | null;
}

export type CreateEventCommentResult =
  | { readonly ok: true; readonly comment: EventComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'event_not_found';
      readonly message: string;
    };

export type ReportEventCommentResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'event_comment_not_found';
      readonly message: string;
    };

export type UpdateEventCommentResult =
  | { readonly ok: true; readonly comment: EventComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'event_comment_not_found' | 'forbidden';
      readonly message: string;
    };
