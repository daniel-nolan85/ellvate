import { notFound } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';
import { FeaturedToggle } from '../featured-toggle';

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

export default async function EventDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('events')
    .select('id, title, starts_at, place, featured, media')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const event = data as EventRow;

  return (
    <DetailLayout
      backHref="/events"
      backLabel="Events"
      deleteAction={{
        confirmLabel: `Delete "${event.title}"? This also removes its comments and RSVPs.`,
        id: event.id,
        table: 'events',
      }}
      fields={[
        { label: 'Starts', value: new Date(event.starts_at).toLocaleString() },
        { label: 'Place', value: event.place },
        {
          label: 'Featured',
          value: <FeaturedToggle eventId={event.id} featured={event.featured} />,
        },
      ]}
      media={<MediaThumbnails media={event.media} />}
      title={event.title}
    />
  );
}
