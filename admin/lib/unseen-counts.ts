import { getFeaturedSuggestions } from './featured-suggestions';
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
  'business_listing_reports',
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

// Only pending listings count toward this badge -- one that was instantly
// domain- or AI-verified needed no admin action, so it shouldn't read as
// "waiting on me" the way Reports' badge otherwise mirrors.
export async function countUnseenBusinessListings(sinceIso: string | null): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from('business_listings')
    .select('id', { count: 'exact', head: true })
    .eq('verification_status', 'pending')
    .gt('created_at', sinceIso ?? EPOCH);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

// Counts suggestions (see featured-suggestions.ts) whose underlying event
// was created after the admin last visited /events -- an imperfect proxy
// (an older event can start qualifying later, e.g. once it takes the lead
// on RSVPs, without this badge noticing), but the same simplification
// every other unseen-count here already makes, and cheap since it reuses
// the same query the page itself renders from.
export async function countUnseenFeaturedSuggestions(sinceIso: string | null): Promise<number> {
  const since = sinceIso ?? EPOCH;
  const suggestions = await getFeaturedSuggestions();
  return suggestions.filter((suggestion) => suggestion.createdAt > since).length;
}

export interface AdminSeenState {
  readonly reportsLastSeenAt: string | null;
  readonly contactMessagesLastSeenAt: string | null;
  readonly landingContactLastSeenAt: string | null;
  readonly waitlistLastSeenAt: string | null;
  readonly businessListingsLastSeenAt: string | null;
  readonly eventsFeaturedSuggestionsLastSeenAt: string | null;
}

export async function getAdminSeenState(email: string | null): Promise<AdminSeenState> {
  if (!email) {
    return {
      businessListingsLastSeenAt: null,
      contactMessagesLastSeenAt: null,
      eventsFeaturedSuggestionsLastSeenAt: null,
      landingContactLastSeenAt: null,
      reportsLastSeenAt: null,
      waitlistLastSeenAt: null,
    };
  }
  const { data, error } = await createSupabaseAdminClient()
    .from('dashboard_admins')
    .select(
      'reports_last_seen_at, contact_messages_last_seen_at, landing_contact_last_seen_at, waitlist_last_seen_at, business_listings_last_seen_at, events_featured_suggestions_last_seen_at',
    )
    .eq('email', email)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return {
    businessListingsLastSeenAt: data?.business_listings_last_seen_at ?? null,
    contactMessagesLastSeenAt: data?.contact_messages_last_seen_at ?? null,
    eventsFeaturedSuggestionsLastSeenAt: data?.events_featured_suggestions_last_seen_at ?? null,
    landingContactLastSeenAt: data?.landing_contact_last_seen_at ?? null,
    reportsLastSeenAt: data?.reports_last_seen_at ?? null,
    waitlistLastSeenAt: data?.waitlist_last_seen_at ?? null,
  };
}
