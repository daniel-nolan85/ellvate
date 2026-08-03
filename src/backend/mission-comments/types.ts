export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface MissionComment {
  readonly id: string;
  readonly missionId: string;
  readonly author: PersonRef;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export type CreateMissionCommentResult =
  | { readonly ok: true; readonly comment: MissionComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'mission_not_found';
      readonly message: string;
    };

export type ReportMissionCommentResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'mission_comment_not_found';
      readonly message: string;
    };

export type UpdateMissionCommentResult =
  | { readonly ok: true; readonly comment: MissionComment }
  | {
      readonly ok: false;
      readonly code: 'invalid_comment' | 'mission_comment_not_found' | 'forbidden';
      readonly message: string;
    };
