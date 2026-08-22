import Link from 'next/link';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  applyDescCursor,
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

interface ServiceListingRow {
  readonly id: string;
  readonly business_name: string;
  readonly category: string;
  readonly description: string;
  readonly contact_phone: string | null;
  readonly contact_email: string | null;
  readonly contact_website: string | null;
  readonly service_area: string | null;
  readonly hours: string | null;
  readonly logo: StoredMedia | null;
  readonly media: readonly StoredMedia[] | null;
  readonly created_at: string;
  readonly creator: { readonly name: string } | null;
}

export default async function ServicesPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('service_listings')
    .select(
      'id, business_name, category, description, contact_phone, contact_email, contact_website, service_area, hours, logo, media, created_at, creator:app_users!service_listings_created_by_fkey(name)',
    );

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`business_name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as unknown as readonly ServiceListingRow[];
  const listings = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: listings[listings.length - 1]!.created_at,
          id: listings[listings.length - 1]!.id,
        })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Services</h1>
        <p className="text-sm text-muted">
          Business listings in the services directory. Deleting a listing
          also removes its reviews.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search name or description…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      {listings.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No listings match "${query}".` : 'No service listings yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => {
            const contactParts = [
              listing.contact_phone,
              listing.contact_email,
              listing.contact_website,
            ].filter(Boolean);
            return (
              <div
                className="rounded-lg border border-border bg-surface p-4"
                key={listing.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {listing.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                      <img
                        alt=""
                        className="h-10 w-10 shrink-0 rounded object-cover"
                        src={listing.logo.url}
                      />
                    ) : null}
                    <div className="min-w-0 space-y-1">
                      <Link
                        className="text-sm font-medium text-content hover:underline"
                        href={`/services/${listing.id}`}
                      >
                        {listing.business_name}
                      </Link>
                      <p className="text-xs text-muted">
                        {listing.creator?.name ?? 'Unknown'} · {listing.category} ·{' '}
                        {formatDate(listing.created_at)}
                      </p>
                    </div>
                  </div>
                  <DeleteButton
                    confirmLabel={`Delete "${listing.business_name}"? This also removes its reviews.`}
                    id={listing.id}
                    table="service_listings"
                  />
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-content">
                  {listing.description}
                </p>
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  {contactParts.length > 0 ? <p>{contactParts.join(' · ')}</p> : null}
                  {listing.service_area ? <p>Service area: {listing.service_area}</p> : null}
                  {listing.hours ? <p>Hours: {listing.hours}</p> : null}
                </div>
                {listing.media && listing.media.length > 0 ? (
                  <div className="mt-2">
                    <MediaThumbnails media={listing.media} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/services?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
