import { notFound } from 'next/navigation';

import { formatDateTime } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../detail-layout';

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

export default async function ContactDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('contact_messages')
    .select('id, category, message, created_at, user:app_users(name)')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const msg = data as unknown as ContactMessageRow;

  return (
    <DetailLayout
      backHref="/contact"
      backLabel="Contact messages"
      body={msg.message}
      deleteAction={{
        confirmLabel: 'Delete this message?',
        id: msg.id,
        table: 'contact_messages',
      }}
      fields={[
        { label: 'Category', value: CATEGORY_LABEL[msg.category] ?? msg.category },
        { label: 'From', value: msg.user?.name ?? 'Unknown' },
        { label: 'Sent', value: formatDateTime(msg.created_at) },
      ]}
      title="Contact message"
    />
  );
}
