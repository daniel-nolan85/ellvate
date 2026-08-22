import Link from 'next/link';

import { isCommentTab, loadCommentTab, type CommentTab } from '@/lib/comments-data';
import { formatDate } from '@/lib/format-date';

import { DeleteButton } from '../delete-button';

const TABS: readonly { readonly key: CommentTab; readonly label: string }[] = [
  { key: 'forum', label: 'Forum' },
  { key: 'event', label: 'Event' },
  { key: 'mission', label: 'Mission' },
  { key: 'service-review', label: 'Service Reviews' },
  { key: 'petition', label: 'Petition' },
];

export default async function CommentsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly tab?: string; readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const tab: CommentTab = isCommentTab(params.tab) ? params.tab : 'forum';
  const query = params.q?.trim() ?? '';
  const { rows, table, nextCursor } = await loadCommentTab(tab, query, params.cursor);

  const qSuffix = query ? `&q=${encodeURIComponent(query)}` : '';

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Comments</h1>
        <p className="text-sm text-muted">
          Forum, event, and mission comments, plus service reviews — every
          user-generated reply across the app.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            className={`rounded-t-lg px-3 py-1.5 text-sm ${
              t.key === tab
                ? 'border border-b-0 border-border bg-surface text-content'
                : 'text-muted hover:text-content'
            }`}
            href={`/comments?tab=${t.key}${qSuffix}`}
            key={t.key}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="flex gap-2" method="get">
        <input name="tab" type="hidden" value={tab} />
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search comment text…"
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
            <th className="pb-2 font-normal">Comment</th>
            <th className="pb-2 font-normal">Author</th>
            <th className="pb-2 font-normal">On</th>
            <th className="pb-2 font-normal">Posted</th>
            <th className="pb-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="py-4 text-sm text-muted" colSpan={5}>
                {query ? `No comments match "${query}".` : 'Nothing here yet.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="border-b border-border last:border-0" key={row.id}>
                <td className="max-w-md whitespace-pre-wrap py-2 pr-4 text-sm text-content">
                  <Link className="hover:underline" href={`/comments/${tab}/${row.id}`}>
                    {row.body}
                  </Link>
                </td>
                <td className="py-2 pr-4 text-xs text-muted">{row.author?.name ?? 'Unknown'}</td>
                <td className="py-2 pr-4 text-xs text-muted">{row.target}</td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {formatDate(row.created_at)}
                </td>
                <td className="py-2 text-right">
                  <DeleteButton confirmLabel="Delete this comment?" id={row.id} table={table} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/comments?tab=${tab}${qSuffix}&cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
