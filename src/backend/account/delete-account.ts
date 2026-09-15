import { listBookmarkIds, toggleBookmark } from '@/src/backend/bookmarks';
import { deleteComment } from '@/src/backend/comments';
import { deleteEventComment } from '@/src/backend/event-comments';
import { toggleJoin } from '@/src/backend/events';
import { deletePost, toggleLike } from '@/src/backend/forum';
import type { RequestContext } from '@/src/backend/http';
import { deleteMissionComment } from '@/src/backend/mission-comments';
import { toggleMute } from '@/src/backend/mutes';
import { deletePetitionComment } from '@/src/backend/petition-comments';
import { toggleSignature } from '@/src/backend/petitions';
import { deleteServiceReview } from '@/src/backend/service-reviews';
import { deleteServiceListing } from '@/src/backend/services';
import { getState, setState } from '@/src/backend/store';

import { deleteAccountSupabase } from './delete-account-supabase';

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

// Reuses each module's own delete/toggle function (called AS the deleting
// user, via ctx) rather than hand-rolling cascades — deletePost already
// removes comments+reports on that post, deleteServiceListing already
// removes its reviews+reports, etc. This keeps deletion behavior for shared
// content in one place (the module that owns it) instead of duplicating it
// here.
//
// Events/missions the user created are deliberately left in place rather
// than deleted, mirroring Supabase's `ON DELETE SET NULL` on
// events.created_by / missions.created_by — the community content
// (an event people RSVP'd to, a mission others are mid-progress on) outlives
// the creator's account. Their `authorId` is left pointing at the
// now-deleted user id; toAuthorRef's not-found fallback ("Former member")
// already renders that correctly everywhere the author is displayed.
async function deleteAccountMemory(ctx: RequestContext): Promise<void> {
  const userId = ctx.userId;

  for (const listing of getState().serviceListings) {
    if (listing.authorId === userId) {
      await deleteServiceListing(ctx, listing.id);
    }
  }
  for (const review of getState().serviceReviews) {
    if (review.authorId === userId) {
      await deleteServiceReview(ctx, review.id);
    }
  }
  for (const post of getState().posts) {
    if (post.authorId === userId) {
      await deletePost(ctx, post.id);
    }
  }
  for (const comment of getState().comments) {
    if (comment.authorId === userId) {
      await deleteComment(ctx, comment.id);
    }
  }
  for (const post of getState().posts) {
    if (post.likedBy.includes(userId)) {
      await toggleLike(ctx, post.id);
    }
  }
  for (const comment of getState().eventComments) {
    if (comment.authorId === userId) {
      await deleteEventComment(ctx, comment.id);
    }
  }
  for (const comment of getState().missionComments) {
    if (comment.authorId === userId) {
      await deleteMissionComment(ctx, comment.id);
    }
  }
  for (const comment of getState().petitionComments) {
    if (comment.authorId === userId) {
      await deletePetitionComment(ctx, comment.id);
    }
  }
  for (const event of getState().events) {
    if (event.joinedBy.includes(userId)) {
      await toggleJoin(ctx, event.id);
    }
  }
  for (const signature of getState().petitionSignatures) {
    if (signature.userId === userId) {
      await toggleSignature(ctx, signature.petitionId);
    }
  }
  const ownMutes = getState().users.find((user) => user.id === userId)?.mutedUserIds ?? [];
  for (const mutedId of ownMutes) {
    await toggleMute(ctx, mutedId);
  }
  for (const bookmark of await listBookmarkIds(ctx)) {
    await toggleBookmark(ctx, bookmark);
  }

  // Everything below has no reusable business-logic function to call
  // (see the module's research notes) — direct state manipulation, all in
  // one pass, finishing with the user's own row so every earlier step above
  // still finds it via ensureUser()/current.users lookups.
  setState((current) => {
    const remainingPostIds = new Set(current.posts.map((post) => post.id));
    const removedCheckInIds = new Set(
      current.missionCheckIns
        .filter((checkIn) => checkIn.userId === userId)
        .map((checkIn) => checkIn.id),
    );
    return {
      ...current,
      missionCheckInPhotoReports: current.missionCheckInPhotoReports.filter(
        (report) => !removedCheckInIds.has(report.checkInId),
      ),
      missionCheckIns: current.missionCheckIns.filter(
        (checkIn) => checkIn.userId !== userId,
      ),
      events: current.events.map((event) =>
        event.attendeeIds.includes(userId)
          ? {
              ...event,
              attendeeIds: event.attendeeIds.filter((id) => id !== userId),
            }
          : event,
      ),
      missions: current.missions.map((mission) =>
        userId in mission.progressByUser
          ? {
              ...mission,
              progressByUser: Object.fromEntries(
                Object.entries(mission.progressByUser).filter(
                  ([id]) => id !== userId,
                ),
              ),
            }
          : mission,
      ),
      notifications: current.notifications.filter(
        (notification) => notification.userId !== userId,
      ),
      users: current.users
        .filter((user) => user.id !== userId)
        .map((user) => ({
          ...user,
          mutedUserIds: user.mutedUserIds.filter((id) => id !== userId),
          pinnedPostId:
            user.pinnedPostId && !remainingPostIds.has(user.pinnedPostId)
              ? null
              : user.pinnedPostId,
        })),
    };
  });
}

export async function deleteAccount(ctx: RequestContext): Promise<void> {
  if (ctx.supabase) {
    await deleteAccountSupabase(ctx.supabase, ctx.userId);
    return;
  }
  await deleteAccountMemory(ctx);
}
