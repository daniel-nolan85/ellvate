import { notFound } from 'next/navigation';

import { formatDateTime } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';

interface CheckInRow {
  readonly id: string;
  readonly stop_index: number;
  readonly completed_at: string;
  readonly photo_url: string | null;
  readonly mission: { readonly title: string } | null;
  readonly user: { readonly name: string } | null;
}

export default async function MissionCheckInDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('mission_check_ins')
    .select(
      'id, stop_index, completed_at, photo_url, mission:missions(title), user:app_users(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const checkIn = data as unknown as CheckInRow;

  return (
    <DetailLayout
      backHref="/reports"
      backLabel="Reports"
      deleteAction={{
        confirmLabel: 'Delete this check-in? This resolves the report too.',
        id: checkIn.id,
        table: 'mission_check_ins',
      }}
      fields={[
        { label: 'Mission', value: checkIn.mission?.title ?? 'Unknown mission' },
        { label: 'Member', value: checkIn.user?.name ?? 'Unknown' },
        { label: 'Completed', value: formatDateTime(checkIn.completed_at) },
      ]}
      media={
        checkIn.photo_url ? (
          <MediaThumbnails media={[{ filename: 'check-in-photo', url: checkIn.photo_url }]} />
        ) : null
      }
      title={`Stop ${checkIn.stop_index + 1} check-in`}
    />
  );
}
