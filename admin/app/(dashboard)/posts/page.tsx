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
import { MediaThumbnails } from '../media-thumbnails';

interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface PostRow {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly forum: string;
  readonly created_at: string;
  readonly media: readonly StoredMedia[] | null;
  readonly author: { readonly name: string } | null;
}

export default async function PostsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly q?: string; readonly cursor?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? '';

  const admin = createSupabaseAdminClient();
  let request = admin
    .from('posts')
    .select(
      'id, title, excerpt, forum, created_at, media, author:app_users!posts_author_id_fkey(name)',
    );

  if (query) {
    const term = escapeOrSearchTerm(query);
    request = request.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  }
  request = applyDescCursor(request, 'created_at', 'id', params.cursor);

  const { data, error } = await request
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(LIST_PAGE_SIZE + 1);
  if (error) {
    throw error;
  }
  const rows = (data ?? []) as unknown as readonly PostRow[];
  const posts = rows.slice(0, LIST_PAGE_SIZE);
  const nextCursor =
    rows.length > LIST_PAGE_SIZE
      ? encodeCursor({ sortKey: posts[posts.length - 1]!.created_at, id: posts[posts.length - 1]!.id })
      : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Posts</h1>
        <p className="text-sm text-muted">
          Forum posts across every subforum. Deleting a post also removes its
          comments and likes.
        </p>
      </div>

      <form className="flex gap-2" method="get">
        <input
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-content outline-none focus:border-accent"
          defaultValue={query}
          name="q"
          placeholder="Search title or content…"
          type="text"
        />
        <button
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          type="submit"
        >
          Search
        </button>
      </form>

      {posts.length === 0 ? (
        <p className="text-sm text-muted">
          {query ? `No posts match "${query}".` : 'No posts yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div className="rounded-lg border border-border bg-surface p-4" key={post.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Link
                    className="text-sm font-medium text-content hover:underline"
                    href={`/posts/${post.id}`}
                  >
                    {post.title}
                  </Link>
                  <p className="text-xs text-muted">
                    {post.author?.name ?? 'Unknown'} · {post.forum} ·{' '}
                    {formatDate(post.created_at)}
                  </p>
                </div>
                <DeleteButton
                  confirmLabel={`Delete "${post.title}"? This also removes its comments.`}
                  id={post.id}
                  table="posts"
                />
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-content">
                {post.excerpt}
              </p>
              {post.media && post.media.length > 0 ? (
                <div className="mt-2">
                  <MediaThumbnails media={post.media} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {nextCursor ? (
        <Link
          className="inline-block rounded-lg border border-border px-3 py-1.5 text-sm text-content hover:bg-surface-raised"
          href={`/posts?${query ? `q=${encodeURIComponent(query)}&` : ''}cursor=${encodeURIComponent(nextCursor)}`}
        >
          Load more
        </Link>
      ) : null}
    </div>
  );
}
