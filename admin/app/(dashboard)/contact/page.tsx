import Link from 'next/link';

import { getCurrentAdminEmail } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyDescCursor, encodeCursor, escapeOrSearchTerm, LIST_PAGE_SIZE } from '@/lib/pagination';

import { DeleteButton } from '../delete-button';

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  bug: 'Bug report',
  feedback: 'Feedback',
  question: 'Question',
  other: 'Other',
};

interface ContactMessageRow {
  readonly id: string;
  readonly category: string;
  readonly message: string;
  readonly created_at: string;
  readonly user: { readonly name: string } | null;
}

export default async function ContactPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('contact_messages')
    .select('id, category, message, created_at, user:app_users(name)');
  if (query) {
    request = request.ilike('message', `%${escapeOrSearchTerm(query)}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const adminEmail = await getCurrentAdminEmail();
  const markSeen = adminEmail
    ? admin
        .from('dashboard_admins')
        .update({ contact_messages_last_seen_at: new Date().toISOString() })
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
  const rows = (data ?? []) as unknown as readonly ContactMessageRow[];
  const messages = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: messages[messages.length - 1]!.created_at,
          id: messages[messages.length - 1]!.id,
        })
      : null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Contact messages</h1>
        <p className="text-sm text-muted">
          Messages members send directly to moderators from the app, outside
          of reporting a specific piece of content.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search message text…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      {messages.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No messages match "${query}".` : 'No messages yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={msg.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted">
                    {CATEGORY_LABEL[msg.category] ?? msg.category} · {msg.user?.name ?? 'Unknown'} ·{' '}
                    {new Date(msg.created_at).toLocaleDateString()}
                  </p>
                </div>
                <DeleteButton
                  confirmLabel="Delete this message?"
                  id={msg.id}
                  table="contact_messages"
                />
              </div>
              <Link className="mt-2 block hover:underline" href={`/contact/${msg.id}`}>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-content">
                  {msg.message}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/contact?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
