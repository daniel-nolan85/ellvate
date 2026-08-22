import { notFound } from 'next/navigation';

import { isCommentTab, loadCommentById } from '@/lib/comments-data';
import { formatDate } from '@/lib/format-date';

import { DetailLayout } from '../../../detail-layout';

export default async function CommentDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly table: string; readonly id: string }>;
}) {
  const { table, id } = await params;
  if (!isCommentTab(table)) {
    notFound();
  }
  const comment = await loadCommentById(table, id);
  if (!comment) {
    notFound();
  }

  return (
    <DetailLayout
      backHref="/comments"
      backLabel="Comments"
      body={comment.body}
      deleteAction={{
        confirmLabel: 'Delete this comment?',
        id,
        table: comment.deletableTable,
      }}
      subtitle={`${comment.authorName} · ${comment.targetLabel} · ${formatDate(comment.createdAt)}`}
      title="Comment"
    />
  );
}
