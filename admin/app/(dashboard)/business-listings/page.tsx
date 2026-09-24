import Link from 'next/link';

import { formatDate } from '@/lib/format-date';
import { getCurrentAdminEmail } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  applyDescCursor,
  encodeCursor,
  escapeOrSearchTerm,
  LIST_PAGE_SIZE,
} from '@/lib/pagination';

import { DeleteButton } from '../delete-button';
import { MediaThumbnails } from '../media-thumbnails';
import { ApproveButton } from './approve-button';

interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface BusinessListingRow {
  readonly id: string;
  readonly business_name: string;
  readonly category: string;
  readonly description: string;
  readonly contact_phone: string | null;
  readonly contact_email: string | null;
  readonly contact_website: string | null;
  readonly address: string | null;
  readonly hours: string | null;
  readonly logo: StoredMedia | null;
  readonly media: readonly StoredMedia[] | null;
  readonly verification_status: string;
  readonly verification_method: string | null;
  readonly verification_notes: string | null;
  readonly created_at: string;
  readonly creator: { readonly name: string } | null;
}

export default async function BusinessListingsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  const adminEmail = await getCurrentAdminEmail();

  // Marking "seen" rides along with the page's own query, same as Reports --
  // see reports-data.ts's identical comment for why this doesn't block the
  // render on a separate round trip.
  const markSeen = adminEmail
    ? admin
        .from('dashboard_admins')
        .update({ business_listings_last_seen_at: new Date().toISOString() })
        .eq('email', adminEmail)
    : Promise.resolve();

  let request = admin
    .from('business_listings')
    .select(
      'id, business_name, category, description, contact_phone, contact_email, contact_website, address, hours, logo, media, verification_status, verification_method, verification_notes, created_at, creator:app_users!business_listings_created_by_fkey(name)',
    );

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`business_name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const [{ data, error }] = await Promise.all([
    request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1),
    markSeen,
  ]);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as unknown as readonly BusinessListingRow[];
  const listings = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: listings[listings.length - 1]!.created_at,
          id: listings[listings.length - 1]!.id,
        })
      : null;
  const pendingCount = listings.filter(
    (listing) => listing.verification_status === 'pending',
  ).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Business listings</h1>
        <p className="text-sm text-muted">
          {pendingCount > 0
            ? `${pendingCount} awaiting review. `
            : ''}
          Listings that couldn&apos;t be verified automatically (no matching
          contact domain, or an uncertain Claude review) wait here for manual
          approval. Deleting a listing rejects it.
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
          {query ? `No listings match "${query}".` : 'No business listings yet.'}
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
                        href={`/business-listings/${listing.id}`}
                      >
                        {listing.business_name}
                      </Link>
                      <p className="text-xs text-muted">
                        {listing.creator?.name ?? 'Unknown'} · {listing.category} ·{' '}
                        {formatDate(listing.created_at)}
                      </p>
                      {listing.verification_status === 'verified' ? (
                        <p className="text-xs font-medium text-success">
                          Verified · {listing.verification_method ?? 'unknown method'}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-warning">Pending review</p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {listing.verification_status === 'pending' ? (
                      <ApproveButton listingId={listing.id} />
                    ) : null}
                    <DeleteButton
                      confirmLabel={
                        listing.verification_status === 'pending'
                          ? `Reject "${listing.business_name}"? This deletes the listing.`
                          : `Delete "${listing.business_name}"?`
                      }
                      id={listing.id}
                      table="business_listings"
                    />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-content">
                  {listing.description}
                </p>
                {listing.verification_notes ? (
                  <p className="mt-2 rounded-lg border border-border bg-canvas p-2 text-xs text-muted">
                    <span className="font-medium text-content">Claude&apos;s reasoning: </span>
                    {listing.verification_notes}
                  </p>
                ) : null}
                <div className="mt-2 space-y-0.5 text-xs text-muted">
                  {contactParts.length > 0 ? <p>{contactParts.join(' · ')}</p> : null}
                  {listing.address ? <p>Address: {listing.address}</p> : null}
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
          href={`/business-listings?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
