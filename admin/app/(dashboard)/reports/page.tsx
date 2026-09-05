import Link from 'next/link';

import { getCurrentAdminEmail } from '@/lib/auth';
import { formatDate } from '@/lib/format-date';
import { reportReasonLabel } from '@/lib/report-reasons';
import { loadReports } from '@/lib/reports-data';

import { DeleteButton } from '../delete-button';

export default async function ReportsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const adminEmail = await getCurrentAdminEmail();
  const { rows, hasNext, hasPrev } = await loadReports(query, page, adminEmail);
  const qSuffix = query ? `&q=${encodeURIComponent(query)}` : '';

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Reports</h1>
        <p className="text-sm text-muted">
          Every report filed across posts, events, missions, petitions,
          comments, reviews, mission check-in photos, and member profiles
          directly, newest first. Deleting the reported content (or, for a
          &quot;Member&quot; row, the reported account itself) clears its
          report too.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search by reporter name…"
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
            <th className="pb-2 font-normal">Type</th>
            <th className="pb-2 font-normal">Content</th>
            <th className="pb-2 font-normal">Reason</th>
            <th className="pb-2 font-normal">Reported by</th>
            <th className="pb-2 font-normal">Reported</th>
            <th className="pb-2 font-normal text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="py-4 text-sm text-muted" colSpan={6}>
                {query ? `No reports from a reporter matching "${query}".` : 'No reports filed yet.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="border-b border-border last:border-0" key={`${row.type}-${row.id}`}>
                <td className="py-2 pr-4 text-xs text-muted">{row.type}</td>
                <td className="max-w-xs py-2 pr-4 text-sm text-content">
                  {row.photoUrl ? (
                    <Link href={row.detailHref ?? '#'}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL */}
                      <img
                        alt="Reported check-in photo"
                        className="h-10 w-10 rounded object-cover"
                        src={row.photoUrl}
                      />
                    </Link>
                  ) : row.detailHref ? (
                    <Link className="block truncate hover:underline" href={row.detailHref}>
                      {row.snippet}
                    </Link>
                  ) : (
                    <span className="block truncate">{row.snippet}</span>
                  )}
                </td>
                <td className="max-w-xs py-2 pr-4 text-xs text-content">
                  <span className="block font-medium text-content">
                    {reportReasonLabel(row.reason)}
                  </span>
                  {row.details ? (
                    <span className="mt-0.5 block truncate text-muted" title={row.details}>
                      {row.details}
                    </span>
                  ) : null}
                  {row.evidenceImageUrl ? (
                    <a
                      className="mt-1 inline-block"
                      href={row.evidenceImageUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL */}
                      <img
                        alt="Report evidence"
                        className="h-10 w-10 rounded object-cover"
                        src={row.evidenceImageUrl}
                      />
                    </a>
                  ) : null}
                </td>
                <td className="py-2 pr-4 text-xs text-muted">{row.reporter}</td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {formatDate(row.created_at)}
                </td>
                <td className="py-2 text-right">
                  <DeleteButton
                    confirmLabel={`Delete this ${row.type.toLowerCase()}? This resolves the report too.`}
                    id={row.deleteId}
                    table={row.deleteTable}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
            href={`/reports?page=${page - 1}${qSuffix}`}
          >
            Previous
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
            href={`/reports?page=${page + 1}${qSuffix}`}
          >
            Load more
          </Link>
        ) : null}
      </div>
    </div>
  );
}
