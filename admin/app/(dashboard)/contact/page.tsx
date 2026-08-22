import Link from 'next/link';

import { getCurrentAdminEmail } from '@/lib/auth';
import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { applyDescCursor, encodeCursor, escapeOrSearchTerm, LIST_PAGE_SIZE } from '@/lib/pagination';

import { DeleteButton } from '../delete-button';

const CATEGORY_LABEL: Readonly<Record<string, string>> = {
  bug: 'Bug report',
  feedback: 'Feedback',
  question: 'Question',
  other: 'Other',
};

type ContactTab = 'app' | 'landing';

function isContactTab(value: string | undefined): value is ContactTab {
  return value === 'app' || value === 'landing';
}

interface AppContactRow {
  readonly id: string;
  readonly category: string;
  readonly message: string;
  readonly created_at: string;
  readonly user: { readonly name: string } | null;
}

interface LandingContactRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly created_at: string;
}

export default async function ContactPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly tab?: string; readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const tab: ContactTab = isContactTab(params.tab) ? params.tab : 'app';
  const query = params.q?.trim() ?? '';
  const qSuffix = query ? `&q=${encodeURIComponent(query)}` : '';

  const admin = createSupabaseAdminClient();
  const adminEmail = await getCurrentAdminEmail();

  // Each tab tracks its own "seen" timestamp (see 0037's landing_contact_last_seen_at
  // vs 0031's contact_messages_last_seen_at) -- viewing one tab shouldn't
  // silently clear the other tab's unread badge.
  const seenColumn = tab === 'app' ? 'contact_messages_last_seen_at' : 'landing_contact_last_seen_at';
  const markSeen = adminEmail
    ? admin
        .from('dashboard_admins')
        .update({ [seenColumn]: new Date().toISOString() })
        .eq('email', adminEmail)
    : Promise.resolve();

  if (tab === 'landing') {
    let request = admin
      .from('landing_contact_messages')
      .select('id, name, email, subject, message, created_at');
    if (query) {
      request = request.or(
        `subject.ilike.%${escapeOrSearchTerm(query)}%,message.ilike.%${escapeOrSearchTerm(query)}%,name.ilike.%${escapeOrSearchTerm(query)}%`,
      );
    }
    request = applyDescCursor(request, 'created_at', 'id', params.cursor);

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
    const rows = (data ?? []) as unknown as readonly LandingContactRow[];
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
        <Header />
        <Tabs active={tab} qSuffix={qSuffix} />
        <SearchForm placeholder="Search subject, message, or name…" query={query} tab={tab} />

        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            {query ? `No messages match "${query}".` : 'No landing page messages yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div className="rounded-lg border border-border bg-surface p-4" key={msg.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted">
                      {msg.name} · {msg.email} · {formatDate(msg.created_at)}
                    </p>
                  </div>
                  <DeleteButton
                    confirmLabel="Delete this message?"
                    id={msg.id}
                    table="landing_contact_messages"
                  />
                </div>
                <Link className="mt-2 block hover:underline" href={`/contact/landing/${msg.id}`}>
                  <p className="text-sm font-medium text-content">{msg.subject}</p>
                  <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted">{msg.message}</p>
                </Link>
              </div>
            ))}
          </div>
        )}

        {nextCursor ? (
          <Link
            className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
            href={`/contact?tab=landing${qSuffix}&cursor=${encodeURIComponent(nextCursor)}`}
          >
            Load more
          </Link>
        ) : null}
      </div>
    );
  }

  let request = admin.from('contact_messages').select('id, category, message, created_at, user:app_users(name)');
  if (query) {
    request = request.ilike('message', `%${escapeOrSearchTerm(query)}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

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
  const rows = (data ?? []) as unknown as readonly AppContactRow[];
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
      <Header />
      <Tabs active={tab} qSuffix={qSuffix} />
      <SearchForm placeholder="Search message text…" query={query} tab={tab} />

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
                    {formatDate(msg.created_at)}
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
          href={`/contact?tab=app${qSuffix}&cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-content">Contact messages</h1>
      <p className="text-sm text-muted">
        Messages sent directly to moderators -- from signed-in members inside the
        app, and from anyone on the public landing page.
      </p>
    </div>
  );
}

function Tabs({ active, qSuffix }: { readonly active: ContactTab; readonly qSuffix: string }) {
  const tabs: readonly { readonly key: ContactTab; readonly label: string }[] = [
    { key: 'app', label: 'App' },
    { key: 'landing', label: 'Landing page' },
  ];
  return (
    <div className="flex gap-1 border-b border-border">
      {tabs.map((t) => (
        <Link
          className={`rounded-t-lg px-3 py-1.5 text-sm ${
            t.key === active
              ? 'border border-b-0 border-border bg-surface text-content'
              : 'text-muted hover:text-content'
          }`}
          href={`/contact?tab=${t.key}${qSuffix}`}
          key={t.key}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

function SearchForm({
  tab,
  query,
  placeholder,
}: {
  readonly tab: ContactTab;
  readonly query: string;
  readonly placeholder: string;
}) {
  return (
    <form className="flex gap-2" method="get">
      <input name="tab" type="hidden" value={tab} />
      <input
        className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
        defaultValue={query}
        name="q"
        placeholder={placeholder}
        type="text"
      />
      <button
        className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
