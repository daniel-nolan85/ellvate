import type { XpGrantOutcome } from '@/src/backend/xp';

export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly isAdmin: boolean;
}

export interface EventMedia {
  readonly url: string;
  readonly filename: string;
}

export interface CommunityEvent {
  readonly id: string;
  readonly author: PersonRef;
  readonly startsAt: string;
  readonly timeLabel: string;
  readonly endsAt: string | null;
  readonly endTimeLabel: string | null;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly cost: string | null;
  readonly media?: readonly EventMedia[];
  readonly featured: boolean;
  readonly going: number;
  readonly joined: boolean;
  readonly attendees: readonly PersonRef[];
  // "I'm interested" -- deliberately separate from going/joined/attendees
  // (see 0082_event_interests.sql's own WHY): a lighter-weight signal that
  // doesn't commit to attending and isn't scored anywhere.
  readonly interestedCount: number;
  readonly interested: boolean;
  readonly editedAt: string | null;
}

export interface WeekDay {
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly date: string;
  readonly isToday: boolean;
}

export interface EventsView {
  readonly week: readonly WeekDay[];
  readonly events: readonly CommunityEvent[];
}

export interface EventsPage {
  readonly events: readonly CommunityEvent[];
  readonly nextCursor: string | null;
}

export interface ListEventsOptions {
  // Restricts the page to events starting on this exact calendar day
  // (YYYY-MM-DD) -- mirrors the calendar's tap-a-day filter.
  readonly date?: string | null;
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface MyEventsPage {
  readonly events: readonly CommunityEvent[];
  readonly nextCursor: string | null;
}

export interface MyEventsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface EventAttendeesPage {
  readonly attendees: readonly PersonRef[];
  readonly nextCursor: string | null;
}

export interface EventInterestedPage {
  readonly interested: readonly PersonRef[];
  readonly nextCursor: string | null;
}

export interface JoinResult {
  readonly id: string;
  readonly going: number;
  readonly joined: boolean;
}

export interface InterestedResult {
  readonly id: string;
  readonly interestedCount: number;
  readonly interested: boolean;
}

export interface ComposedEvent {
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly startsAt: string;
  readonly timeLabel: string;
  readonly endsAt: string | null;
  readonly endTimeLabel: string | null;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly cost: string | null;
}

export type EventValidation =
  | { readonly ok: true; readonly value: ComposedEvent }
  | {
      readonly ok: false;
      readonly code: 'invalid_event';
      readonly message: string;
    };

// What createEventMemory/createEventSupabase themselves return -- the XP
// grant happens one level up, in createEvent, so these two don't have an
// xpAward to report yet.
export type CreatedEventResult =
  | { readonly ok: true; readonly event: CommunityEvent }
  | {
      readonly ok: false;
      readonly code: 'invalid_event' | 'media_upload_failed';
      readonly message: string;
    };

export type CreateEventResult =
  | {
      readonly ok: true;
      readonly event: CommunityEvent;
      readonly xpAward: XpGrantOutcome;
    }
  | {
      readonly ok: false;
      readonly code: 'invalid_event' | 'media_upload_failed';
      readonly message: string;
    };

export type UpdateEventResult =
  | { readonly ok: true; readonly event: CommunityEvent }
  | {
      readonly ok: false;
      readonly code:
        | 'invalid_event'
        | 'event_not_found'
        | 'forbidden'
        | 'media_upload_failed';
      readonly message: string;
    };

export type ReportEventResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'event_not_found';
      readonly message: string;
    };
