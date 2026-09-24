import type { RequestContext } from '@/src/backend/http';
import { getState, type BusinessCategory, type StoredBusinessListing } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  getBusinessesByIdsSupabase,
  getBusinessesViewSupabase,
  getMyBusinessListingsViewSupabase,
  listBusinessesPageSupabase,
} from './business-listings-supabase';
import { toBusinessListingView } from './business-listing-view';
import type {
  BusinessesPage,
  BusinessesView,
  BusinessListing,
  ListBusinessesOptions,
  MyBusinessListingsOptions,
  MyBusinessListingsPage,
} from './types';

export const DEFAULT_MY_BUSINESSES_PAGE_SIZE = 20;
export const MAX_MY_BUSINESSES_PAGE_SIZE = 50;
export const DEFAULT_BUSINESSES_PAGE_SIZE = 20;
export const MAX_BUSINESSES_PAGE_SIZE = 50;

// Real Postgres RLS restricts every select on business_listings to
// `verification_status = 'verified' OR created_by = self` (see migration
// 0066); memory mode has no RLS, so every memory-mode read below must apply
// this same rule by hand. The Supabase-backed functions in
// business-listings-supabase.ts deliberately apply no such filter -- RLS
// already did it before the rows reached them.
const isVisible = (listing: StoredBusinessListing, userId: string): boolean =>
  listing.verificationStatus === 'verified' || listing.authorId === userId;

function getBusinessesViewMemory(
  userId: string,
  category: BusinessCategory | undefined,
): BusinessesView {
  const state = getState();
  const listings = state.businessListings
    .filter((listing) => isVisible(listing, userId))
    .filter((listing) => !category || listing.category === category)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((listing) => toBusinessListingView(listing, state.users));
  return { listings };
}

// The paginated counterpart to getBusinessesViewMemory (used by the public
// directory; getBusinessesViewMemory itself stays unbounded for internal
// callers like the assistant's local search). createdAt already sorts
// newest-first via paginateInMemory's descending sort.
function listBusinessesPageMemory(
  userId: string,
  category: BusinessCategory | undefined,
  limit: number,
  cursor: string | null,
): BusinessesPage {
  const state = getState();
  const viewer = state.users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const filtered = state.businessListings
    .filter((listing) => isVisible(listing, userId))
    .filter((listing) => !category || listing.category === category)
    .filter((listing) => !mutedUserIds.has(listing.authorId))
    .map((listing) => ({ id: listing.id, listing, sortKey: listing.createdAt }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    listings: page.items.map((item) => toBusinessListingView(item.listing, state.users)),
    nextCursor: page.nextCursor,
  };
}

// Scoped to listings the caller created — used by a "my listings" management
// view. Ownership already implies visibility, so no isVisible filter needed
// here (mirrors getMyServiceListingsViewMemory).
function getMyBusinessListingsViewMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): MyBusinessListingsPage {
  const state = getState();
  const mine = state.businessListings
    .filter((listing) => listing.authorId === userId)
    .map((listing) => ({
      id: listing.id,
      listing,
      sortKey: listing.createdAt,
    }));
  const page = paginateInMemory(mine, limit, cursor);
  return {
    listings: page.items.map((item) => toBusinessListingView(item.listing, state.users)),
    nextCursor: page.nextCursor,
  };
}

// Fetches specific listings by id — used to hydrate bookmarks, which can
// point at any listing regardless of authorship. Still applies isVisible: a
// bookmark pointing at someone else's now-unverified listing shouldn't
// resurface it.
function getBusinessesByIdsMemory(
  userId: string,
  ids: readonly string[],
): readonly BusinessListing[] {
  const state = getState();
  const idSet = new Set(ids);
  return state.businessListings
    .filter((listing) => idSet.has(listing.id) && isVisible(listing, userId))
    .map((listing) => toBusinessListingView(listing, state.users));
}

export async function getBusinessesView(
  ctx: RequestContext,
  options?: ListBusinessesOptions,
): Promise<BusinessesView> {
  return ctx.supabase
    ? getBusinessesViewSupabase(ctx.supabase, options?.category)
    : getBusinessesViewMemory(ctx.userId, options?.category);
}

// The paginated, filtered counterpart to getBusinessesView, used by the
// public directory (see listBusinessesPageMemory for why the two are kept
// separate).
export async function listBusinessesPage(
  ctx: RequestContext,
  options?: ListBusinessesOptions,
): Promise<BusinessesPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_BUSINESSES_PAGE_SIZE),
    MAX_BUSINESSES_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listBusinessesPageSupabase(ctx.supabase, ctx.userId, options?.category, limit, cursor)
    : listBusinessesPageMemory(ctx.userId, options?.category, limit, cursor);
}

export async function getBusinessesByIds(
  ctx: RequestContext,
  ids: readonly string[],
): Promise<readonly BusinessListing[]> {
  if (ids.length === 0) {
    return [];
  }
  return ctx.supabase
    ? getBusinessesByIdsSupabase(ctx.supabase, ids)
    : getBusinessesByIdsMemory(ctx.userId, ids);
}

export async function getMyBusinessListingsView(
  ctx: RequestContext,
  options?: MyBusinessListingsOptions,
): Promise<MyBusinessListingsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MY_BUSINESSES_PAGE_SIZE),
    MAX_MY_BUSINESSES_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getMyBusinessListingsViewSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : getMyBusinessListingsViewMemory(ctx.userId, limit, cursor);
}
