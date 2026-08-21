import { notFound } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly xp: number;
  readonly missions_completed: number;
  readonly streak_days: number;
  readonly created_at: string;
  readonly avatar_url: string | null;
}

export default async function UserDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('app_users')
    .select('id, name, role, xp, missions_completed, streak_days, created_at, avatar_url')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const user = data as UserRow;

  return (
    <DetailLayout
      backHref="/users"
      backLabel="Users"
      deleteAction={{
        confirmLabel: `Permanently delete ${user.name}? This removes every post, comment, mission, and listing they've ever created. This cannot be undone.`,
        id: user.id,
        table: 'app_users',
      }}
      fields={[
        { label: 'Role', value: user.role ?? '—' },
        { label: 'XP', value: user.xp },
        { label: 'Missions completed', value: user.missions_completed },
        { label: 'Streak', value: `${user.streak_days}d` },
        { label: 'Joined', value: new Date(user.created_at).toLocaleDateString() },
      ]}
      media={
        user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img alt="" className="h-16 w-16 rounded-full object-cover" src={user.avatar_url} />
        ) : null
      }
      title={user.name}
    />
  );
}
