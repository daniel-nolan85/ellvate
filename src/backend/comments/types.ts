export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface Comment {
  readonly id: string;
  readonly postId: string;
  readonly author: PersonRef;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface CommentsPage {
  readonly comments: readonly Comment[];
  readonly nextCursor: string | null;
}

export interface MyComment {
  readonly id: string;
  readonly postId: string;
  readonly postTitle: string;
  readonly body: string;
  readonly createdAt: string;
}

export type CreateCommentResult =
  | { readonly ok: true; readonly comment: Comment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'post_not_found';
      readonly message: string;
    };

export type ReportCommentResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'comment_not_found';
      readonly message: string;
    };

export type UpdateCommentResult =
  | { readonly ok: true; readonly comment: Comment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'comment_not_found' | 'forbidden';
      readonly message: string;
    };
