export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface PetitionComment {
  readonly id: string;
  readonly petitionId: string;
  readonly author: PersonRef;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface PetitionCommentsPage {
  readonly comments: readonly PetitionComment[];
  readonly nextCursor: string | null;
}

export type CreatePetitionCommentResult =
  | { readonly ok: true; readonly comment: PetitionComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'petition_not_found';
      readonly message: string;
    };

export type ReportPetitionCommentResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'petition_comment_not_found';
      readonly message: string;
    };

export type UpdatePetitionCommentResult =
  | { readonly ok: true; readonly comment: PetitionComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'petition_comment_not_found' | 'forbidden';
      readonly message: string;
    };
