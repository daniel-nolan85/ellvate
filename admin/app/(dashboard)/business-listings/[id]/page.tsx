import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';
import { ApproveButton } from '../approve-button';

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

export default async function BusinessListingDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('business_listings')
    .select(
      'id, business_name, category, description, contact_phone, contact_email, contact_website, address, hours, logo, media, verification_status, verification_method, verification_notes, created_at, creator:app_users!business_listings_created_by_fkey(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const listing = data as unknown as BusinessListingRow;
  const contactParts = [
    listing.contact_phone,
    listing.contact_email,
    listing.contact_website,
  ].filter(Boolean);

  const media = [
    ...(listing.logo ? [listing.logo] : []),
    ...(listing.media ?? []),
  ];

  return (
    <DetailLayout
      backHref="/business-listings"
      backLabel="Business listings"
      body={listing.description}
      deleteAction={{
        confirmLabel:
          listing.verification_status === 'pending'
            ? `Reject "${listing.business_name}"? This deletes the listing.`
            : `Delete "${listing.business_name}"?`,
        id: listing.id,
        table: 'business_listings',
      }}
      fields={[
        { label: 'Category', value: listing.category },
        { label: 'Creator', value: listing.creator?.name ?? 'Unknown' },
        { label: 'Contact', value: contactParts.length > 0 ? contactParts.join(' · ') : '—' },
        { label: 'Address', value: listing.address ?? '—' },
        { label: 'Hours', value: listing.hours ?? '—' },
        {
          label: 'Verification',
          value:
            listing.verification_status === 'verified'
              ? `Verified · ${listing.verification_method ?? 'unknown method'}`
              : 'Pending review',
        },
      ]}
      media={media.length > 0 ? <MediaThumbnails media={media} /> : null}
      subtitle={formatDate(listing.created_at)}
      title={listing.business_name}
    >
      {listing.verification_notes ? (
        <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          <span className="font-medium text-content">Claude&apos;s reasoning: </span>
          {listing.verification_notes}
        </p>
      ) : null}
      {listing.verification_status === 'pending' ? (
        <ApproveButton listingId={listing.id} />
      ) : null}
    </DetailLayout>
  );
}
