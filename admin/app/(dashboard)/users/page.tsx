import Link from 'next/link';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyDescCursor, encodeCursor, LIST_PAGE_SIZE } from '@/lib/pagination';

import { DeleteButton } from '../delete-button';

import { AdminToggle } from './admin-toggle';

interface UserRow {
  readonly id: string;
  readonly name: string;
  readonly role: string | null;
  readonly xp: number;
  readonly missions_completed: number;
  readonly created_at: string;
  readonly avatar_url: string | null;
  readonly is_admin: boolean;
}

export default async function UsersPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('app_users')
    .select('id, name, role, xp, missions_completed, created_at, avatar_url, is_admin');
  if (query) {
    request = request.ilike('name', `%${query}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as readonly UserRow[];
  const users = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({ sortKey: users[users.length - 1]!.created_at, id: users[users.length - 1]!.id })
      : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Users</h1>
        <p className="text-sm text-muted">
          Every member of the community. Deleting a user removes their
          entire history — every post, comment, mission, and listing they
          ever created — not just their profile, bans their account so they
          can&apos;t sign back in, and emails them that they&apos;ve been
          removed (requires CLERK_SECRET_KEY / RESEND_API_KEY /
          ADMIN_FROM_EMAIL to be configured — the deletion itself always
          works, the ban and email are best-effort on top of it). This is a
          permanent, irreversible action. Marking someone Admin adds a mark
          next to their name on their own content in the app, distinct from
          who can sign in here.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search by name…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2 font-normal">Name</th>
            <th className="pb-2 font-normal">Role</th>
            <th className="pb-2 font-normal">XP</th>
            <th className="pb-2 font-normal">Missions done</th>
            <th className="pb-2 font-normal">Joined</th>
            <th className="pb-2 font-normal">Admin</th>
            <th className="pb-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td className="py-4 text-sm text-muted" colSpan={7}>
                {query ? `No members match "${query}".` : 'No members yet.'}
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr className="border-b border-border last:border-0" key={user.id}>
                <td className="py-2 pr-4 text-sm text-content">
                  <Link className="flex items-center gap-2 hover:underline" href={`/users/${user.id}`}>
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                      <img
                        alt=""
                        className="h-6 w-6 rounded-full object-cover"
                        src={user.avatar_url}
                      />
                    ) : null}
                    {user.name}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-xs text-muted">{user.role ?? '—'}</td>
                <td className="py-2 pr-4 text-xs text-muted">{user.xp}</td>
                <td className="py-2 pr-4 text-xs text-muted">{user.missions_completed}</td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {formatDate(user.created_at)}
                </td>
                <td className="py-2 pr-4">
                  <AdminToggle isAdmin={user.is_admin} userId={user.id} />
                </td>
                <td className="py-2 text-right">
                  <DeleteButton
                    confirmLabel={`Permanently delete ${user.name}? This removes every post, comment, mission, and listing they've ever created, bans their account so they can't sign back in, and emails them that they've been removed. This cannot be undone.`}
                    id={user.id}
                    table="app_users"
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/users?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
