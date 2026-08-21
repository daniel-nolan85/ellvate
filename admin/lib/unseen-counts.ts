import { createSupabaseAdminClient } from './supabase/admin';

const REPORT_TABLES = [
  'post_reports',
  'comment_reports',
  'event_comment_reports',
  'mission_comment_reports',
  'service_review_reports',
  'mission_check_in_reports',
  'petition_reports',
  'petition_comment_reports',
] as const;

const EPOCH = new Date(0).toISOString();

export async function countUnseenReports(sinceIso: string | null): Promise<number> {
  const admin = createSupabaseAdminClient();
  const since = sinceIso ?? EPOCH;
  const results = await Promise.all(
    REPORT_TABLES.map((table) =>
      admin.from(table).select('id', { count: 'exact', head: true }).gt('created_at', since),
    ),
  );
  let total = 0;
  for (const result of results) {
    if (result.error) {
      throw result.error;
    }
    total += result.count ?? 0;
  }
  return total;
}

export async function countUnseenContactMessages(sinceIso: string | null): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from('contact_messages')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', sinceIso ?? EPOCH);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export interface AdminSeenState {
  readonly reportsLastSeenAt: string | null;
  readonly contactMessagesLastSeenAt: string | null;
}

export async function getAdminSeenState(email: string | null): Promise<AdminSeenState> {
  if (!email) {
    return { contactMessagesLastSeenAt: null, reportsLastSeenAt: null };
  }
  const { data, error } = await createSupabaseAdminClient()
    .from('dashboard_admins')
    .select('reports_last_seen_at, contact_messages_last_seen_at')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return {
    contactMessagesLastSeenAt: data?.contact_messages_last_seen_at ?? null,
    reportsLastSeenAt: data?.reports_last_seen_at ?? null,
  };
}
