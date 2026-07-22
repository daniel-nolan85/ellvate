export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

export interface Media {
  readonly url: string;
  readonly filename: string;
}

export interface ForumPost {
  readonly id: string;
  readonly forum: string;
  readonly author: PersonRef;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly media?: readonly Media[];
  readonly replies: number;
  readonly likes: number;
  readonly liked: boolean;
  readonly pinned: boolean;
}

export type CreatePostResult =
  | { readonly ok: true; readonly post: ForumPost }
  | {
      readonly ok: false;
      readonly code: 'invalid_post' | 'media_upload_failed';
      readonly message: string;
    };

export type UpdatePostResult =
  | { readonly ok: true; readonly post: ForumPost }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_post'
        | 'post_not_found'
        | 'forbidden'
        | 'media_upload_failed';
      readonly message: string;
    };

export interface LikeResult {
  readonly id: string;
  readonly likes: number;
  readonly liked: boolean;
}

export interface MyPostsPage {
  readonly posts: readonly ForumPost[];
  readonly nextCursor: string | null;
}

export interface MyPostsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}
