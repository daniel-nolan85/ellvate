export interface PersonRef {
  readonly id: string;
  readonly name: string;
}

export interface ForumPost {
  readonly id: string;
  readonly forum: string;
  readonly author: PersonRef;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly replies: number;
  readonly likes: number;
  readonly liked: boolean;
  readonly pinned: boolean;
}

export type CreatePostResult =
  | { readonly ok: true; readonly post: ForumPost }
  | {
      readonly ok: false;
      readonly code: 'invalid_post';
      readonly message: string;
    };

export type UpdatePostResult =
  | { readonly ok: true; readonly post: ForumPost }
  | {
      readonly ok: false;
      readonly code: 'invalid_post' | 'post_not_found' | 'forbidden';
      readonly message: string;
    };

export interface LikeResult {
  readonly id: string;
  readonly likes: number;
  readonly liked: boolean;
}
