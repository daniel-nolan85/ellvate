import { notFound } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';

interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface MissionRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly xp: number;
  readonly theme: string;
  readonly stops: readonly string[] | null;
  readonly media: readonly StoredMedia[] | null;
  readonly creator: { readonly name: string } | null;
}

export default async function MissionDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('missions')
    .select(
      'id, title, description, xp, theme, stops, media, creator:app_users!missions_created_by_fkey(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const mission = data as unknown as MissionRow;

  return (
    <DetailLayout
      backHref="/missions"
      backLabel="Missions"
      body={mission.description}
      deleteAction={{
        confirmLabel: `Delete "${mission.title}"? This also removes its comments, progress, and check-ins.`,
        id: mission.id,
        table: 'missions',
      }}
      fields={[
        { label: 'XP', value: mission.xp },
        { label: 'Theme', value: mission.theme },
        { label: 'Creator', value: mission.creator?.name ?? 'Curated' },
      ]}
      media={
        mission.media && mission.media.length > 0 ? (
          <MediaThumbnails media={mission.media} />
        ) : null
      }
      title={mission.title}
    >
      {mission.stops && mission.stops.length > 0 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[1px] text-muted">Stops</p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-content">
            {mission.stops.map((stop, index) => (
              <li key={index}>{stop}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </DetailLayout>
  );
}
