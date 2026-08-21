import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import type { DeletableTable } from '../app/(dashboard)/actions';
import { applyDescCursor, encodeCursor, escapeOrSearchTerm, LIST_PAGE_SIZE } from './pagination';

export type CommentTab = 'forum' | 'event' | 'mission' | 'service-review' | 'petition';

export function isCommentTab(value: string | undefined): value is CommentTab {
  return (
    value === 'forum' ||
    value === 'event' ||
    value === 'mission' ||
    value === 'service-review' ||
    value === 'petition'
  );
}

export interface CommentRow {
  readonly id: string;
  readonly body: string;
  readonly created_at: string;
  readonly author: { readonly name: string } | null;
  readonly target: string;
}

export interface CommentTabResult {
  readonly rows: readonly CommentRow[];
  readonly table: DeletableTable;
  readonly nextCursor: string | null;
}

export async function loadCommentTab(
  tab: CommentTab,
  query: string,
  cursor: string | undefined,
): Promise<CommentTabResult> {
  const admin = createSupabaseAdminClient();

  if (tab === 'forum') {
    let request = admin
      .from('comments')
      .select('id, body, created_at, author:app_users(name), post:posts(title)');
    if (query) {
      request = request.ilike('body', `%${escapeOrSearchTerm(query)}%`);
    }
    request = applyDescCursor(request, 'created_at', 'id', cursor);
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1);
    if (error) {
      throw error;
    }
    const raw = (data ?? []) as unknown as readonly {
      id: string;
      body: string;
      created_at: string;
      author: { name: string } | null;
      post: { title: string } | null;
    }[];
    const rows = raw.slice(0, LIST_PAGE_SIZE).map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author: r.author,
      target: r.post?.title ?? 'Unknown post',
    }));
    return {
      table: 'comments',
      rows,
      nextCursor:
        raw.length > LIST_PAGE_SIZE
          ? encodeCursor({ sortKey: rows[rows.length - 1]!.created_at, id: rows[rows.length - 1]!.id })
          : null,
    };
  }

  if (tab === 'event') {
    let request = admin
      .from('event_comments')
      .select('id, body, created_at, author:app_users(name), event:events(title)');
    if (query) {
      request = request.ilike('body', `%${escapeOrSearchTerm(query)}%`);
    }
    request = applyDescCursor(request, 'created_at', 'id', cursor);
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1);
    if (error) {
      throw error;
    }
    const raw = (data ?? []) as unknown as readonly {
      id: string;
      body: string;
      created_at: string;
      author: { name: string } | null;
      event: { title: string } | null;
    }[];
    const rows = raw.slice(0, LIST_PAGE_SIZE).map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author: r.author,
      target: r.event?.title ?? 'Unknown event',
    }));
    return {
      table: 'event_comments',
      rows,
      nextCursor:
        raw.length > LIST_PAGE_SIZE
          ? encodeCursor({ sortKey: rows[rows.length - 1]!.created_at, id: rows[rows.length - 1]!.id })
          : null,
    };
  }

  if (tab === 'mission') {
    let request = admin
      .from('mission_comments')
      .select('id, body, created_at, author:app_users(name), mission:missions(title)');
    if (query) {
      request = request.ilike('body', `%${escapeOrSearchTerm(query)}%`);
    }
    request = applyDescCursor(request, 'created_at', 'id', cursor);
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1);
    if (error) {
      throw error;
    }
    const raw = (data ?? []) as unknown as readonly {
      id: string;
      body: string;
      created_at: string;
      author: { name: string } | null;
      mission: { title: string } | null;
    }[];
    const rows = raw.slice(0, LIST_PAGE_SIZE).map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author: r.author,
      target: r.mission?.title ?? 'Unknown mission',
    }));
    return {
      table: 'mission_comments',
      rows,
      nextCursor:
        raw.length > LIST_PAGE_SIZE
          ? encodeCursor({ sortKey: rows[rows.length - 1]!.created_at, id: rows[rows.length - 1]!.id })
          : null,
    };
  }

  if (tab === 'service-review') {
    let request = admin
      .from('service_reviews')
      .select(
        'id, body, rating, created_at, author:app_users(name), listing:service_listings(business_name)',
      );
    if (query) {
      request = request.ilike('body', `%${escapeOrSearchTerm(query)}%`);
    }
    request = applyDescCursor(request, 'created_at', 'id', cursor);
    const { data, error } = await request
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(LIST_PAGE_SIZE + 1);
    if (error) {
      throw error;
    }
    const raw = (data ?? []) as unknown as readonly {
      id: string;
      body: string | null;
      rating: number;
      created_at: string;
      author: { name: string } | null;
      listing: { business_name: string } | null;
    }[];
    const rows = raw.slice(0, LIST_PAGE_SIZE).map((r) => ({
      id: r.id,
      body: r.body ? `${'★'.repeat(r.rating)} — ${r.body}` : '★'.repeat(r.rating),
      created_at: r.created_at,
      author: r.author,
      target: r.listing?.business_name ?? 'Unknown listing',
    }));
    return {
      table: 'service_reviews',
      rows,
      nextCursor:
        raw.length > LIST_PAGE_SIZE
          ? encodeCursor({ sortKey: rows[rows.length - 1]!.created_at, id: rows[rows.length - 1]!.id })
          : null,
    };
  }

  let request = admin
    .from('petition_comments')
    .select('id, body, created_at, author:app_users(name), petition:petitions(title)');
  if (query) {
    request = request.ilike('body', `%${escapeOrSearchTerm(query)}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', cursor);
  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const raw = (data ?? []) as unknown as readonly {
    id: string;
    body: string;
    created_at: string;
    author: { name: string } | null;
    petition: { title: string } | null;
  }[];
  const rows = raw.slice(0, LIST_PAGE_SIZE).map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    author: r.author,
    target: r.petition?.title ?? 'Unknown petition',
  }));
  return {
    table: 'petition_comments',
    rows,
    nextCursor:
      raw.length > LIST_PAGE_SIZE
        ? encodeCursor({ sortKey: rows[rows.length - 1]!.created_at, id: rows[rows.length - 1]!.id })
        : null,
  };
}

interface ResolvedComment {
  readonly body: string;
  readonly authorName: string;
  readonly targetLabel: string;
  readonly createdAt: string;
  readonly deletableTable: DeletableTable;
}

export async function loadCommentById(
  tab: CommentTab,
  id: string,
): Promise<ResolvedComment | null> {
  const admin = createSupabaseAdminClient();

  if (tab === 'forum') {
    const { data, error } = await admin
      .from('comments')
      .select('id, body, created_at, author:app_users(name), post:posts(title)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as {
      body: string;
      created_at: string;
      author: { name: string } | null;
      post: { title: string } | null;
    };
    return {
      body: row.body,
      authorName: row.author?.name ?? 'Unknown',
      targetLabel: row.post?.title ?? 'Unknown post',
      createdAt: row.created_at,
      deletableTable: 'comments',
    };
  }

  if (tab === 'event') {
    const { data, error } = await admin
      .from('event_comments')
      .select('id, body, created_at, author:app_users(name), event:events(title)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as {
      body: string;
      created_at: string;
      author: { name: string } | null;
      event: { title: string } | null;
    };
    return {
      body: row.body,
      authorName: row.author?.name ?? 'Unknown',
      targetLabel: row.event?.title ?? 'Unknown event',
      createdAt: row.created_at,
      deletableTable: 'event_comments',
    };
  }

  if (tab === 'mission') {
    const { data, error } = await admin
      .from('mission_comments')
      .select('id, body, created_at, author:app_users(name), mission:missions(title)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as {
      body: string;
      created_at: string;
      author: { name: string } | null;
      mission: { title: string } | null;
    };
    return {
      body: row.body,
      authorName: row.author?.name ?? 'Unknown',
      targetLabel: row.mission?.title ?? 'Unknown mission',
      createdAt: row.created_at,
      deletableTable: 'mission_comments',
    };
  }

  if (tab === 'service-review') {
    const { data, error } = await admin
      .from('service_reviews')
      .select(
        'id, body, rating, created_at, author:app_users(name), listing:service_listings(business_name)',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as unknown as {
      body: string | null;
      rating: number;
      created_at: string;
      author: { name: string } | null;
      listing: { business_name: string } | null;
    };
    return {
      body: row.body ? `${'★'.repeat(row.rating)} — ${row.body}` : '★'.repeat(row.rating),
      authorName: row.author?.name ?? 'Unknown',
      targetLabel: row.listing?.business_name ?? 'Unknown listing',
      createdAt: row.created_at,
      deletableTable: 'service_reviews',
    };
  }

  const { data, error } = await admin
    .from('petition_comments')
    .select('id, body, created_at, author:app_users(name), petition:petitions(title)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as {
    body: string;
    created_at: string;
    author: { name: string } | null;
    petition: { title: string } | null;
  };
  return {
    body: row.body,
    authorName: row.author?.name ?? 'Unknown',
    targetLabel: row.petition?.title ?? 'Unknown petition',
    createdAt: row.created_at,
    deletableTable: 'petition_comments',
  };
}
