import { notFound } from 'next/navigation';

import { formatDateTime } from '@/lib/format-date';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { DetailLayout } from '../../../detail-layout';

interface LandingContactRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly subject: string;
  readonly message: string;
  readonly created_at: string;
}

export default async function LandingContactDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('landing_contact_messages')
    .select('id, name, email, subject, message, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    notFound();
  }
  const msg = data as unknown as LandingContactRow;

  return (
    <DetailLayout
      backHref="/contact?tab=landing"
      backLabel="Contact messages"
      body={msg.message}
      deleteAction={{
        confirmLabel: 'Delete this message?',
        id: msg.id,
        table: 'landing_contact_messages',
      }}
      fields={[
        { label: 'From', value: msg.name },
        { label: 'Email', value: msg.email },
        { label: 'Sent', value: formatDateTime(msg.created_at) },
      ]}
      subtitle={msg.subject}
      title="Landing page message"
    />
  );
}
