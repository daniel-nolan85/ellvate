export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface Comment {
  readonly id: string;
  readonly postId: string;
  readonly author: PersonRef;
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
