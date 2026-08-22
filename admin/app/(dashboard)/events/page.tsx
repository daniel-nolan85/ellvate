import Link from 'next/link';

import { formatDateTime } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { decodeCursor, escapeOrSearchTerm, LIST_PAGE_SIZE } from '@/lib/pagination';

import { DeleteButton } from '../delete-button';
import { MediaThumbnails } from '../media-thumbnails';

import { FeaturedToggle } from './featured-toggle';

interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface EventRow {
  readonly id: string;
  readonly title: string;
  readonly starts_at: string;
  readonly place: string;
  readonly featured: boolean;
  readonly media: readonly StoredMedia[] | null;
}

// events' sort is composite (featured desc, starts_at asc), so its keyset
// cursor needs its own 3-branch filter rather than the generic single-
// column helper: still-featured rows with a later starts_at, the exact
// boundary row tiebroken by id, or any row that's already dropped out of
// the featured tier entirely.
function applyEventsCursor<Q extends { or(filters: string): Q }>(
  query: Q,
  cursor: string | undefined,
): Q {
  const parsed = decodeCursor(cursor);
  if (!parsed) {
    return query;
  }
  const [featuredFlag, startsAt] = parsed.sortKey.split('|');
  if (featuredFlag === '1') {
    return query.or(
      `and(featured.eq.true,starts_at.gt.${startsAt}),and(featured.eq.true,starts_at.eq.${startsAt},id.gt.${parsed.id}),featured.eq.false`,
    );
  }
  return query.or(
    `and(featured.eq.false,starts_at.gt.${startsAt}),and(featured.eq.false,starts_at.eq.${startsAt},id.gt.${parsed.id})`,
  );
}

export default async function EventsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin.from('events').select('id, title, starts_at, place, featured, media');

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`title.ilike.%${term}%,place.ilike.%${term}%`);
  }
  request = applyEventsCursor(request, params.cursor);

  const { data, error } = await request
    .order('featured', { ascending: false })
    .order('starts_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as readonly EventRow[];
  const events = rows.slice(0, LIST_PAGE_SIZE);
  const last = events[events.length - 1];
  const nextCursor =
    rows.length > LIST_PAGE_SIZE && last
      ? `${last.featured ? '1' : '0'}|${last.starts_at}::${last.id}`
      : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Events</h1>
        <p className="text-sm text-muted">
          Mark an event as featured — it gets top billing on the Events
          screen. Deleting an event also removes its comments and RSVPs.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search title or place…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2 font-normal">Title</th>
            <th className="pb-2 font-normal">Starts</th>
            <th className="pb-2 font-normal">Place</th>
            <th className="pb-2 font-normal">Media</th>
            <th className="pb-2 font-normal text-right">Featured</th>
            <th className="pb-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td className="py-4 text-sm text-muted" colSpan={6}>
                {query ? `No events match "${query}".` : 'No events yet.'}
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr className="border-b border-border last:border-0" key={event.id}>
                <td className="py-2 pr-4 text-sm text-content">
                  <Link className="hover:underline" href={`/events/${event.id}`}>
                    {event.title}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {formatDateTime(event.starts_at)}
                </td>
                <td className="py-2 pr-4 text-xs text-muted">{event.place}</td>
                <td className="py-2 pr-4">
                  <MediaThumbnails media={event.media} />
                </td>
                <td className="py-2 pr-4 text-right">
                  <FeaturedToggle eventId={event.id} featured={event.featured} />
                </td>
                <td className="py-2 text-right">
                  <DeleteButton
                    confirmLabel={`Delete "${event.title}"? This also removes its comments and RSVPs.`}
                    id={event.id}
                    table="events"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/events?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
