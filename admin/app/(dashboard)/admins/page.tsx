import { redirect } from 'next/navigation';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AddAdminForm } from './add-admin-form';
import { AdminRow } from './admin-row';

interface DashboardAdminRow {
  readonly email: string;
  readonly created_at: string;
}

export default async function AdminsPage() {
  const session = await createSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user?.email) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('dashboard_admins')
    .select('email, created_at')
    .order('created_at', { ascending: true });
  if (error) {
    throw error;
  }
  const admins = (data ?? []) as readonly DashboardAdminRow[];

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Admins</h1>
        <p className="text-sm text-muted">
          No self-service sign-up — only people on this list can sign in to
          the dashboard, checked on every request.
        </p>
      </div>

      <table className="w-full">
        <tbody>
          {admins.map((row) => (
            <AdminRow
              actingEmail={user.email!}
              createdAt={row.created_at}
              email={row.email}
              key={row.email}
            />
          ))}
        </tbody>
      </table>

      <AddAdminForm />
    </div>
  );
}
