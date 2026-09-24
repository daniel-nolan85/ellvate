import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';

import { searchAllSupabase } from './search-supabase';
import { SEARCH_RESULTS_PER_GROUP, type GlobalSearchResults, type SearchResultItem } from './types';

interface AuthoredResult {
  readonly authorId: string;
  readonly item: SearchResultItem;
}

const matches = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle);

const toGroup = (
  results: readonly AuthoredResult[],
  mutedUserIds: ReadonlySet<string>,
): readonly SearchResultItem[] =>
  results
    .filter((result) => !mutedUserIds.has(result.authorId))
    .slice(0, SEARCH_RESULTS_PER_GROUP)
    .map((result) => result.item);

function searchAllMemory(userId: string, query: string): GlobalSearchResults {
  const state = getState();
  const needle = query.toLowerCase();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);

  return {
    businesses: toGroup(
      state.businessListings
        // The verified-or-own filter Postgres RLS applies automatically on
        // the Supabase path (see business-listings-view.ts's isVisible) has
        // no equivalent here -- memory mode has no RLS, so it's applied by
        // hand before the search even runs.
        .filter(
          (listing) =>
            listing.verificationStatus === 'verified' || listing.authorId === userId,
        )
        .filter((listing) => matches(listing.businessName, needle))
        .map((listing) => ({
          authorId: listing.authorId,
          item: {
            id: listing.id,
            kind: 'business',
            subtitle: listing.description,
            title: listing.businessName,
          },
        })),
      mutedUserIds,
    ),
    events: toGroup(
      state.events
        .filter((event) => matches(event.title, needle))
        .map((event) => ({
          authorId: event.authorId,
          item: { id: event.id, kind: 'event', subtitle: event.place, title: event.title },
        })),
      mutedUserIds,
    ),
    missions: toGroup(
      state.missions
        .filter((mission) => matches(mission.title, needle))
        .map((mission) => ({
          authorId: mission.authorId,
          item: {
            id: mission.id,
            kind: 'mission',
            subtitle: mission.description,
            title: mission.title,
          },
        })),
      mutedUserIds,
    ),
    petitions: toGroup(
      state.petitions
        .filter((petition) => matches(petition.title, needle))
        .map((petition) => ({
          authorId: petition.createdBy,
          item: {
            id: petition.id,
            kind: 'petition',
            subtitle: petition.description,
            title: petition.title,
          },
        })),
      mutedUserIds,
    ),
    posts: toGroup(
      state.posts
        .filter((post) => matches(post.title, needle))
        .map((post) => ({
          authorId: post.authorId,
          item: { id: post.id, kind: 'post', subtitle: post.excerpt, title: post.title },
        })),
      mutedUserIds,
    ),
    services: toGroup(
      state.serviceListings
        .filter((listing) => matches(listing.businessName, needle))
        .map((listing) => ({
          authorId: listing.authorId,
          item: {
            id: listing.id,
            kind: 'service',
            subtitle: listing.description,
            title: listing.businessName,
          },
        })),
      mutedUserIds,
    ),
  };
}

export async function searchAll(
  ctx: RequestContext,
  query: string,
): Promise<GlobalSearchResults> {
  return ctx.supabase
    ? searchAllSupabase(ctx.supabase, ctx.userId, query)
    : searchAllMemory(ctx.userId, query);
}
