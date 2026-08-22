import { notFound } from 'next/navigation';

import { formatDate, formatDateTime } from '@/lib/format-date';
import { buildHoaEmailTemplate } from '@/lib/hoa-email';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';
import { HoaResponseForm } from '../hoa-response-form';
import { SendToHoaForm } from '../send-to-hoa-form';

interface PetitionRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly status: string;
  readonly signature_count: number;
  readonly required_signatures: number;
  readonly deadline_at: string;
  readonly succeeded_at: string | null;
  readonly hoa_email_sent_at: string | null;
  readonly hoa_response: string | null;
  readonly hoa_response_at: string | null;
  readonly created_at: string;
  readonly creator: { readonly name: string } | null;
}

export default async function PetitionDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('petitions')
    .select(
      'id, title, description, category, status, signature_count, required_signatures, deadline_at, succeeded_at, hoa_email_sent_at, hoa_response, hoa_response_at, created_at, creator:app_users!petitions_created_by_fkey(name)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const petition = data as unknown as PetitionRow;
  const needsHoaReview = petition.status === 'succeeded' && !petition.hoa_email_sent_at;
  const draft = needsHoaReview
    ? buildHoaEmailTemplate({
        description: petition.description,
        signatureCount: petition.signature_count,
        title: petition.title,
      })
    : null;

  return (
    <DetailLayout
      backHref="/petitions"
      backLabel="Petitions"
      body={petition.description}
      deleteAction={{
        confirmLabel: `Delete "${petition.title}"? This also removes its comments.`,
        id: petition.id,
        table: 'petitions',
      }}
      fields={[
        { label: 'Category', value: petition.category },
        { label: 'Creator', value: petition.creator?.name ?? 'Unknown' },
        { label: 'Status', value: petition.status },
        {
          label: 'Signatures',
          value: `${petition.signature_count} / ${petition.required_signatures}`,
        },
        { label: 'Deadline', value: formatDateTime(petition.deadline_at) },
        {
          label: 'Succeeded',
          value: petition.succeeded_at ? formatDateTime(petition.succeeded_at) : '—',
        },
        {
          label: 'HOA email sent',
          value: petition.hoa_email_sent_at
            ? formatDateTime(petition.hoa_email_sent_at)
            : needsHoaReview
              ? 'Awaiting review below'
              : '—',
        },
        {
          label: 'HOA responded',
          value: petition.hoa_response_at ? formatDateTime(petition.hoa_response_at) : '—',
        },
      ]}
      subtitle={formatDate(petition.created_at)}
      title={petition.title}
    >
      <div className="space-y-4">
        {draft ? (
          <SendToHoaForm
            initialBody={draft.body}
            initialSubject={draft.subject}
            petitionId={petition.id}
          />
        ) : null}
        {petition.status === 'succeeded' ? (
          <HoaResponseForm
            alreadyNotified={petition.hoa_response_at !== null}
            initialResponse={petition.hoa_response ?? ''}
            petitionId={petition.id}
          />
        ) : null}
      </div>
    </DetailLayout>
  );
}
