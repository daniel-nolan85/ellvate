import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// A signal, not a decision -- see toggleEventFeaturedAction's own comment:
// featuring stays a deliberate admin call. This just surfaces the events
// worth glancing at each week instead of making the admin scroll the whole
// upcoming list themselves: official/HOA business (needs the visibility
// it wouldn't get on its own), a Saturday-night flagship social (the kind
// of thing worth a bit of extra push), and whichever upcoming event is
// already pulling the most RSVPs on its own (context, not a mandate --
// see the "don't just auto-feature the popular one" reasoning this was
// built from).

// Lake Las Vegas, NV -- same reasoning as format-date.ts: this dashboard
// moderates one specific real-world community, so "Saturday night" means
// Saturday night there, not in the server's or the viewing admin's own
// timezone.
const TIME_ZONE = 'America/Los_Angeles';

// Deliberately a plain keyword match, not a dedicated event tag -- events
// have no 'HOA' option in their tag set (src/modules/events/event-composer.tsx's
// TAGS), so this is the only signal available without a schema/product
// decision about whether residents should be able to self-tag an event
// "HOA". Good enough for a suggestion an admin still eyeballs themselves.
const HOA_PATTERN = /\b(HOA|Town Hall|Board Meeting)\b/i;

const SATURDAY_NIGHT_START_HOUR = 18; // 6pm local

// How far ahead to look -- far enough to plan a couple of weekends out,
// not so far that "upcoming" stops meaning anything.
const LOOKAHEAD_DAYS = 14;

export type FeaturedSuggestionFlag = 'hoa' | 'saturday_night' | 'most_rsvp';

export interface FeaturedSuggestion {
  readonly id: string;
  readonly title: string;
  readonly place: string;
  readonly startsAt: string;
  readonly going: number;
  readonly flags: readonly FeaturedSuggestionFlag[];
}

function localWeekdayAndHour(iso: string): { readonly weekday: string; readonly hour: number } {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(date);
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: TIME_ZONE,
    }).format(date),
    10,
  );
  return { hour, weekday };
}

export async function getFeaturedSuggestions(): Promise<readonly FeaturedSuggestion[]> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const { data: eventRows, error: eventsError } = await admin
    .from('events')
    .select('id, title, place, starts_at, going_base')
    .eq('featured', false)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', lookaheadEnd.toISOString())
    .order('starts_at', { ascending: true });
  if (eventsError) {
    throw eventsError;
  }
  const events = (eventRows ?? []) as readonly {
    id: string;
    title: string;
    place: string;
    starts_at: string;
    going_base: number;
  }[];
  if (events.length === 0) {
    return [];
  }

  const ids = events.map((event) => event.id);
  const { data: joinRows, error: joinsError } = await admin
    .from('event_joins')
    .select('event_id')
    .in('event_id', ids);
  if (joinsError) {
    throw joinsError;
  }
  const joinCounts = new Map<string, number>();
  for (const row of (joinRows ?? []) as readonly { event_id: string }[]) {
    joinCounts.set(row.event_id, (joinCounts.get(row.event_id) ?? 0) + 1);
  }

  const withGoing = events.map((event) => ({
    ...event,
    going: event.going_base + (joinCounts.get(event.id) ?? 0),
  }));

  // Only the single most-RSVP'd upcoming event gets the flag -- this is a
  // spotlight on one standout, not a ranking of everything.
  const topGoing = Math.max(...withGoing.map((event) => event.going));

  const suggestions: FeaturedSuggestion[] = [];
  for (const event of withGoing) {
    const flags: FeaturedSuggestionFlag[] = [];
    if (HOA_PATTERN.test(event.title) || HOA_PATTERN.test(event.place)) {
      flags.push('hoa');
    }
    const { hour, weekday } = localWeekdayAndHour(event.starts_at);
    if (weekday === 'Saturday' && hour >= SATURDAY_NIGHT_START_HOUR) {
      flags.push('saturday_night');
    }
    if (event.going > 0 && event.going === topGoing) {
      flags.push('most_rsvp');
    }
    if (flags.length > 0) {
      suggestions.push({
        flags,
        going: event.going,
        id: event.id,
        place: event.place,
        startsAt: event.starts_at,
        title: event.title,
      });
    }
  }

  return suggestions;
}
