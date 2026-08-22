import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';

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

export default async function ServiceDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('service_listings')
    .select(
      'id, business_name, category, description, contact_phone, contact_email, contact_website, service_area, hours, logo, media, created_at, creator:app_users!service_listings_created_by_fkey(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const listing = data as unknown as ServiceListingRow;
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
      backHref="/services"
      backLabel="Services"
      body={listing.description}
      deleteAction={{
        confirmLabel: `Delete "${listing.business_name}"? This also removes its reviews.`,
        id: listing.id,
        table: 'service_listings',
      }}
      fields={[
        { label: 'Category', value: listing.category },
        { label: 'Creator', value: listing.creator?.name ?? 'Unknown' },
        { label: 'Contact', value: contactParts.length > 0 ? contactParts.join(' · ') : '—' },
        { label: 'Service area', value: listing.service_area ?? '—' },
        { label: 'Hours', value: listing.hours ?? '—' },
      ]}
      media={media.length > 0 ? <MediaThumbnails media={media} /> : null}
      subtitle={formatDate(listing.created_at)}
      title={listing.business_name}
    />
  );
}
