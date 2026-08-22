import Link from 'next/link';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  applyDescCursor,
  encodeCursor,
  escapeOrSearchTerm,
  LIST_PAGE_SIZE,
} from '@/lib/pagination';

import { DeleteButton } from '../delete-button';

interface PetitionRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly status: string;
  readonly signature_count: number;
  readonly required_signatures: number;
  readonly deadline_at: string;
  readonly hoa_email_sent_at: string | null;
  readonly created_at: string;
  readonly creator: { readonly name: string } | null;
}

export default async function PetitionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('petitions')
    .select(
      'id, title, category, status, signature_count, required_signatures, deadline_at, hoa_email_sent_at, created_at, creator:app_users!petitions_created_by_fkey(name)',
    );

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as unknown as readonly PetitionRow[];
  const petitions = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({
          sortKey: petitions[petitions.length - 1]!.created_at,
          id: petitions[petitions.length - 1]!.id,
        })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Petitions</h1>
        <p className="text-sm text-muted">
          Member-raised petitions. A petition succeeds once its signature
          count reaches its required threshold, which is frozen at creation
          time and never recalculated.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search title or description…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      {petitions.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No petitions match "${query}".` : 'No petitions yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {petitions.map((petition) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={petition.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      className="text-sm font-medium text-content hover:underline"
                      href={`/petitions/${petition.id}`}
                    >
                      {petition.title}
                    </Link>
                    {petition.status === 'succeeded' && !petition.hoa_email_sent_at ? (
                      <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning">
                        Awaiting board email
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">
                    {petition.creator?.name ?? 'Unknown'} · {petition.category} ·{' '}
                    {petition.status} · {petition.signature_count}/{petition.required_signatures}{' '}
                    signatures · {formatDate(petition.created_at)}
                  </p>
                </div>
                <DeleteButton
                  confirmLabel={`Delete "${petition.title}"? This also removes its comments.`}
                  id={petition.id}
                  table="petitions"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/petitions?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
