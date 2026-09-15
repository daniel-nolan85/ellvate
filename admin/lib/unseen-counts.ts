import { createSupabaseAdminClient } from './supabase/admin';

// All 11 report tables -- this list was missing event_reports/
// mission_reports/member_reports (added later, in migrations 0046/0052,
// after this file was written), which meant reports on events, missions,
// or members directly never counted toward this badge. Mission check-in
// photo reports (removed along with check-in photos in 0058, reintroduced
// in 0059 under a new table name) are back too.
const REPORT_TABLES = [
  'post_reports',
  'comment_reports',
  'event_comment_reports',
  'mission_comment_reports',
  'service_review_reports',
  'petition_reports',
  'petition_comment_reports',
  'event_reports',
  'mission_reports',
  'member_reports',
  'mission_check_in_photo_reports',
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

// Landing site submissions (../../web) -- a separate table and a separate
// "seen" column from the in-app contact_messages above, but folded into the
// same Contact nav badge (see layout.tsx) since they're both "messages
// waiting on a human."
export async function countUnseenLandingContactMessages(sinceIso: string | null): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from('landing_contact_messages')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', sinceIso ?? EPOCH);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function countUnseenWaitlistSignups(sinceIso: string | null): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from('waitlist_signups')
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
  readonly landingContactLastSeenAt: string | null;
  readonly waitlistLastSeenAt: string | null;
}

export async function getAdminSeenState(email: string | null): Promise<AdminSeenState> {
  if (!email) {
    return {
      contactMessagesLastSeenAt: null,
      landingContactLastSeenAt: null,
      reportsLastSeenAt: null,
      waitlistLastSeenAt: null,
    };
  }
  const { data, error } = await createSupabaseAdminClient()
    .from('dashboard_admins')
    .select(
      'reports_last_seen_at, contact_messages_last_seen_at, landing_contact_last_seen_at, waitlist_last_seen_at',
    )
    .eq('email', email)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return {
    contactMessagesLastSeenAt: data?.contact_messages_last_seen_at ?? null,
    landingContactLastSeenAt: data?.landing_contact_last_seen_at ?? null,
    reportsLastSeenAt: data?.reports_last_seen_at ?? null,
    waitlistLastSeenAt: data?.waitlist_last_seen_at ?? null,
  };
}
