export interface PersonRef {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
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
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly media?: readonly EventMedia[];
  readonly featured: boolean;
  readonly going: number;
  readonly joined: boolean;
  readonly attendees: readonly PersonRef[];
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

export interface MyEventsPage {
  readonly events: readonly CommunityEvent[];
  readonly nextCursor: string | null;
}

export interface MyEventsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}

export interface JoinResult {
  readonly id: string;
  readonly going: number;
  readonly joined: boolean;
}

export interface ComposedEvent {
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly startsAt: string;
  readonly timeLabel: string;
  readonly dayLabel: string;
  readonly dateLabel: string;
}

export type EventValidation =
  | { readonly ok: true; readonly value: ComposedEvent }
  | {
      readonly ok: false;
      readonly code: 'invalid_event';
      readonly message: string;
    };

export type CreateEventResult =
  | { readonly ok: true; readonly event: CommunityEvent }
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
