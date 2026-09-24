import type { SupabaseClient } from '@supabase/supabase-js';

import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { SEARCH_RESULTS_PER_GROUP, type GlobalSearchResults, type SearchResultItem } from './types';

// Muted authors can outnumber a small per-group fetch, so each query
// over-fetches before the muted filter trims it back down to
// SEARCH_RESULTS_PER_GROUP -- same tradeoff every other list function in this
// app already accepts (a muted-heavy result set can under-fill a page),
// just applied to a smaller, search-shaped budget.
const FETCH_LIMIT = SEARCH_RESULTS_PER_GROUP * 3;

interface AuthoredResult {
  readonly authorId: string;
  readonly item: SearchResultItem;
}

const toGroup = (
  results: readonly AuthoredResult[],
  mutedUserIds: ReadonlySet<string>,
): readonly SearchResultItem[] =>
  results
    .filter((result) => !mutedUserIds.has(result.authorId))
    .slice(0, SEARCH_RESULTS_PER_GROUP)
    .map((result) => result.item);

interface PostSearchRow {
  readonly id: string;
  readonly author_id: string;
  readonly title: string;
  readonly excerpt: string;
}

interface EventSearchRow {
  readonly id: string;
  readonly created_by: string;
  readonly title: string;
  readonly place: string;
}

interface MissionSearchRow {
  readonly id: string;
  readonly created_by: string;
  readonly title: string;
  readonly description: string;
}

interface ServiceSearchRow {
  readonly id: string;
  readonly created_by: string;
  readonly business_name: string;
  readonly description: string;
}

interface PetitionSearchRow {
  readonly id: string;
  readonly created_by: string | null;
  readonly title: string;
  readonly description: string;
}

interface BusinessSearchRow {
  readonly id: string;
  readonly created_by: string;
  readonly business_name: string;
  readonly description: string;
}

const searchTable = async <Row>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  titleColumn: string,
  query: string,
): Promise<readonly Row[]> => {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .ilike(titleColumn, `%${query}%`)
    .limit(FETCH_LIMIT);
  throwIfSupabaseError(error, `search ${table}`);
  return (data ?? []) as unknown as readonly Row[];
};

export async function searchAllSupabase(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<GlobalSearchResults> {
  const [
    postRows,
    eventRows,
    missionRows,
    serviceRows,
    petitionRows,
    businessRows,
    mutedUserIds,
  ] = await Promise.all([
    searchTable<PostSearchRow>(supabase, 'posts', 'id,author_id,title,excerpt', 'title', query),
    searchTable<EventSearchRow>(supabase, 'events', 'id,created_by,title,place', 'title', query),
    searchTable<MissionSearchRow>(
      supabase,
      'missions',
      'id,created_by,title,description',
      'title',
      query,
    ),
    searchTable<ServiceSearchRow>(
      supabase,
      'service_listings',
      'id,created_by,business_name,description',
      'business_name',
      query,
    ),
    searchTable<PetitionSearchRow>(
      supabase,
      'petitions',
      'id,created_by,title,description',
      'title',
      query,
    ),
    // No manual verified-or-own filter needed here -- RLS on
    // business_listings (see migration 0066) already restricts this select
    // to `verification_status = 'verified' OR created_by = self`, the same
    // way every other Supabase-backed business-listing read in this app
    // relies on RLS rather than filtering in application code.
    searchTable<BusinessSearchRow>(
      supabase,
      'business_listings',
      'id,created_by,business_name,description',
      'business_name',
      query,
    ),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  const mutedSet = new Set(mutedUserIds);

  return {
    businesses: toGroup(
      businessRows.map((row) => ({
        authorId: row.created_by,
        item: {
          id: row.id,
          kind: 'business',
          subtitle: row.description,
          title: row.business_name,
        },
      })),
      mutedSet,
    ),
    events: toGroup(
      eventRows.map((row) => ({
        authorId: row.created_by,
        item: { id: row.id, kind: 'event', subtitle: row.place, title: row.title },
      })),
      mutedSet,
    ),
    missions: toGroup(
      missionRows.map((row) => ({
        authorId: row.created_by,
        item: { id: row.id, kind: 'mission', subtitle: row.description, title: row.title },
      })),
      mutedSet,
    ),
    petitions: toGroup(
      petitionRows.map((row) => ({
        authorId: row.created_by ?? '',
        item: { id: row.id, kind: 'petition', subtitle: row.description, title: row.title },
      })),
      mutedSet,
    ),
    posts: toGroup(
      postRows.map((row) => ({
        authorId: row.author_id,
        item: { id: row.id, kind: 'post', subtitle: row.excerpt, title: row.title },
      })),
      mutedSet,
    ),
    services: toGroup(
      serviceRows.map((row) => ({
        authorId: row.created_by,
        item: { id: row.id, kind: 'service', subtitle: row.description, title: row.business_name },
      })),
      mutedSet,
    ),
  };
}
