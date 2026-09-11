import Link from 'next/link';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  applyAscCursor,
  encodeCursor,
  escapeOrSearchTerm,
  LIST_PAGE_SIZE,
} from '@/lib/pagination';

import { DeleteButton } from '../delete-button';
import { MediaThumbnails } from '../media-thumbnails';

interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface MissionRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly theme: string;
  readonly position: number;
  readonly stops: readonly string[] | null;
  readonly media: readonly StoredMedia[] | null;
  readonly creator: { readonly name: string } | null;
}

// WHY: mirrors src/backend/missions/user-progress.ts's MISSION_COMPLETION_XP
// -- every completed mission now pays out the same flat reward, so the
// column is gone and this is display-only, not a per-mission value.
const MISSION_COMPLETION_XP = 50;

export default async function MissionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('missions')
    .select(
      'id, title, description, theme, position, stops, media, creator:app_users!missions_created_by_fkey(name)',
    );

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  request = applyAscCursor(request, 'position', 'id', params.cursor);

  const { data, error } = await request
    .order('position', { ascending: true })
    .order('id', { ascending: true })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as unknown as readonly MissionRow[];
  const missions = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: String(missions[missions.length - 1]!.position),
          id: missions[missions.length - 1]!.id,
        })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Missions</h1>
        <p className="text-sm text-muted">
          Includes both curated missions (no creator shown) and ones members
          created themselves. Deleting a mission also removes its comments,
          progress, and check-ins.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search title or description…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      {missions.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No missions match "${query}".` : 'No missions yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {missions.map((mission) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={mission.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Link
                    className="text-sm font-medium text-content hover:underline"
                    href={`/missions/${mission.id}`}
                  >
                    {mission.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {mission.creator?.name ?? 'Curated'} · {mission.theme} ·{' '}
                    {MISSION_COMPLETION_XP} XP
                  </p>
                </div>
                <DeleteButton
                  confirmLabel={`Delete "${mission.title}"? This also removes its comments, progress, and check-ins.`}
                  id={mission.id}
                  table="missions"
                />
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-content">
                {mission.description}
              </p>
              {mission.media && mission.media.length > 0 ? (
                <div className="mt-2">
                  <MediaThumbnails media={mission.media} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/missions?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
