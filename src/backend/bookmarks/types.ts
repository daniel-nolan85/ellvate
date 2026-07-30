import type { CommunityEvent } from '@/src/backend/events';
import type { ForumPost } from '@/src/backend/forum';
import type { Mission } from '@/src/backend/missions';
import type { ServiceListing } from '@/src/backend/services';
import type { BookmarkTargetType } from '@/src/backend/store';

export type { BookmarkTargetType } from '@/src/backend/store';

export type BookmarkedItem =
  | {
      readonly kind: 'post';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly post: ForumPost;
    }
  | {
      readonly kind: 'event';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly event: CommunityEvent;
    }
  | {
      readonly kind: 'mission';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly mission: Mission;
    }
  | {
      readonly kind: 'service';
      readonly bookmarkId: string;
      readonly bookmarkedAt: string;
      readonly listing: ServiceListing;
    };

export interface BookmarksPage {
  readonly items: readonly BookmarkedItem[];
  readonly nextCursor: string | null;
}

export interface ListBookmarksOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly targetType?: BookmarkTargetType;
}

export interface BookmarkIdEntry {
  readonly targetType: BookmarkTargetType;
  readonly targetId: string;
}

export type ToggleBookmarkResult =
  | { readonly ok: true; readonly bookmarked: boolean }
  | {
      readonly ok: false;
      readonly code: 'invalid_target' | 'target_not_found';
      readonly message: string;
    };
