import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { AdminToggle } from '../admin-toggle';

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly xp: number;
  readonly missions_completed: number;
  readonly streak_days: number;
  readonly created_at: string;
  readonly avatar_url: string | null;
  readonly is_admin: boolean;
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
    .select('id, name, role, xp, missions_completed, streak_days, created_at, avatar_url, is_admin')
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
        confirmLabel: `Permanently delete ${user.name}? This removes every post, comment, mission, and listing they've ever created, bans their account so they can't sign back in, and emails them that they've been removed. This cannot be undone.`,
        id: user.id,
        table: 'app_users',
      }}
      fields={[
        { label: 'Role', value: user.role ?? '—' },
        { label: 'XP', value: user.xp },
        { label: 'Missions completed', value: user.missions_completed },
        { label: 'Streak', value: `${user.streak_days}d` },
        { label: 'Joined', value: formatDate(user.created_at) },
        {
          label: 'Admin',
          value: <AdminToggle isAdmin={user.is_admin} userId={user.id} />,
        },
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
