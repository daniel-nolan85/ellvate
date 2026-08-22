import Link from 'next/link';

import { getCurrentAdminEmail } from '@/lib/auth';
import { formatDateTime } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyDescCursor, encodeCursor, escapeOrSearchTerm, LIST_PAGE_SIZE } from '@/lib/pagination';

import { DeleteButton } from '../delete-button';

interface WaitlistRow {
  readonly id: string;
  readonly email: string;
  readonly created_at: string;
}

// waitlist_signups (../../../../supabase/migrations/0033_waitlist_signups.sql)
// is written by the landing site (../../../../web) with the public anon
// key -- anyone can insert a row, nobody but this page (service-role) can
// read one back.
export default async function WaitlistPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin.from('waitlist_signups').select('id, email, created_at');
  if (query) {
    request = request.ilike('email', `%${escapeOrSearchTerm(query)}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const adminEmail = await getCurrentAdminEmail();
  const markSeen = adminEmail
    ? admin
        .from('dashboard_admins')
        .update({ waitlist_last_seen_at: new Date().toISOString() })
        .eq('email', adminEmail)
    : Promise.resolve();

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
  const rows = (data ?? []) as unknown as readonly WaitlistRow[];
  const signups = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: signups[signups.length - 1]!.created_at,
          id: signups[signups.length - 1]!.id,
        })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Waitlist</h1>
        <p className="text-sm text-muted">
          Email signups from the landing page, waiting to hear when the app launches.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search email…"
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
            <th className="pb-2 font-normal">Email</th>
            <th className="pb-2 font-normal">Joined</th>
            <th className="pb-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {signups.length === 0 ? (
            <tr>
              <td className="py-4 text-sm text-muted" colSpan={3}>
                {query ? `No signups match "${query}".` : 'No signups yet.'}
              </td>
            </tr>
          ) : (
            signups.map((signup) => (
              <tr className="border-b border-border last:border-0" key={signup.id}>
                <td className="py-2 pr-4 text-sm text-content">{signup.email}</td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {formatDateTime(signup.created_at)}
                </td>
                <td className="py-2 text-right">
                  <DeleteButton
                    confirmLabel="Remove this signup?"
                    id={signup.id}
                    table="waitlist_signups"
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
          href={`/waitlist?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
