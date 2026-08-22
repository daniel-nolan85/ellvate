import { notFound } from 'next/navigation';

import { formatDate } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { MediaThumbnails } from '../../media-thumbnails';

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

export default async function PostDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('posts')
    .select(
      'id, title, excerpt, forum, created_at, media, author:app_users!posts_author_id_fkey(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const post = data as unknown as PostRow;

  return (
    <DetailLayout
      backHref="/posts"
      backLabel="Posts"
      body={post.excerpt}
      deleteAction={{
        confirmLabel: `Delete "${post.title}"? This also removes its comments.`,
        id: post.id,
        table: 'posts',
      }}
      media={
        post.media && post.media.length > 0 ? (
          <MediaThumbnails media={post.media} />
        ) : null
      }
      subtitle={`${post.author?.name ?? 'Unknown'} · ${post.forum} · ${formatDate(post.created_at)}`}
      title={post.title}
    />
  );
}
