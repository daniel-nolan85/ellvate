import type { RequestContext } from '@/src/backend/http';
import { getState, type ServiceCategory } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import {
  getMyServiceListingsViewSupabase,
  getServicesByIdsSupabase,
  getServicesViewSupabase,
  listServicesPageSupabase,
} from './services-supabase';
import { toServiceListingView } from './service-view';
import type {
  ListServicesOptions,
  MyServiceListingsOptions,
  MyServiceListingsPage,
  ServiceListing,
  ServicesPage,
  ServicesView,
} from './types';

export const DEFAULT_MY_SERVICES_PAGE_SIZE = 20;
export const MAX_MY_SERVICES_PAGE_SIZE = 50;
export const DEFAULT_SERVICES_PAGE_SIZE = 20;
export const MAX_SERVICES_PAGE_SIZE = 50;

function getServicesViewMemory(
  category: ServiceCategory | undefined,
): ServicesView {
  const state = getState();
  const listings = state.serviceListings
    .filter((listing) => !category || listing.category === category)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((listing) =>
      toServiceListingView(listing, state.users, state.serviceReviews),
    );
  return { listings };
}

// The paginated counterpart to getServicesViewMemory (used by the public
// directory; getServicesViewMemory itself stays unbounded for internal
// callers like the assistant's local search). createdAt already sorts
// newest-first via paginateInMemory's descending sort, unlike missions'
// position or events' startsAt -- no sortKey inversion needed here.
function listServicesPageMemory(
  category: ServiceCategory | undefined,
  limit: number,
  cursor: string | null,
): ServicesPage {
  const state = getState();
  const filtered = state.serviceListings
    .filter((listing) => !category || listing.category === category)
    .map((listing) => ({ id: listing.id, listing, sortKey: listing.createdAt }));
  const page = paginateInMemory(filtered, limit, cursor);

  return {
    listings: page.items.map((item) =>
      toServiceListingView(item.listing, state.users, state.serviceReviews),
    ),
    nextCursor: page.nextCursor,
  };
}

// Scoped to listings the caller created — used by a "my listings" management
// view, mirrors getMyMissionsView's ownership-scoped pagination.
function getMyServiceListingsViewMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): MyServiceListingsPage {
  const state = getState();
  const mine = state.serviceListings
    .filter((listing) => listing.authorId === userId)
    .map((listing) => ({
      id: listing.id,
      listing,
      sortKey: listing.createdAt,
    }));
  const page = paginateInMemory(mine, limit, cursor);
  return {
    listings: page.items.map((item) =>
      toServiceListingView(item.listing, state.users, state.serviceReviews),
    ),
    nextCursor: page.nextCursor,
  };
}

// Fetches specific listings by id — used to hydrate bookmarks, which can
// point at any listing regardless of authorship.
function getServicesByIdsMemory(
  ids: readonly string[],
): readonly ServiceListing[] {
  const state = getState();
  const idSet = new Set(ids);
  return state.serviceListings
    .filter((listing) => idSet.has(listing.id))
    .map((listing) =>
      toServiceListingView(listing, state.users, state.serviceReviews),
    );
}

export async function getServicesView(
  ctx: RequestContext,
  options?: ListServicesOptions,
): Promise<ServicesView> {
  return ctx.supabase
    ? getServicesViewSupabase(ctx.supabase, options?.category)
    : getServicesViewMemory(options?.category);
}

// The paginated, filtered counterpart to getServicesView, used by the public
// directory (see listServicesPageMemory for why the two are kept separate).
export async function listServicesPage(
  ctx: RequestContext,
  options?: ListServicesOptions,
): Promise<ServicesPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_SERVICES_PAGE_SIZE),
    MAX_SERVICES_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? listServicesPageSupabase(ctx.supabase, options?.category, limit, cursor)
    : listServicesPageMemory(options?.category, limit, cursor);
}

export async function getServicesByIds(
  ctx: RequestContext,
  ids: readonly string[],
): Promise<readonly ServiceListing[]> {
  if (ids.length === 0) {
    return [];
  }
  return ctx.supabase
    ? getServicesByIdsSupabase(ctx.supabase, ids)
    : getServicesByIdsMemory(ids);
}

export async function getMyServiceListingsView(
  ctx: RequestContext,
  options?: MyServiceListingsOptions,
): Promise<MyServiceListingsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MY_SERVICES_PAGE_SIZE),
    MAX_MY_SERVICES_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getMyServiceListingsViewSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : getMyServiceListingsViewMemory(ctx.userId, limit, cursor);
}
