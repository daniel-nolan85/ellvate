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

export interface EventsPage {
  readonly events: readonly CommunityEvent[];
  readonly nextCursor: string | null;
}

export interface MyEventsPage {
  readonly events: readonly CommunityEvent[];
  readonly nextCursor: string | null;
}

export interface ToggleJoinResult {
  readonly id: string;
  readonly going: number;
  readonly joined: boolean;
}

export interface NewEventMediaInput {
  readonly filename: string;
  readonly dataUrl: string;
}

export interface CreateEventInput {
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly date: string;
  readonly time: string;
  readonly newMedia?: readonly NewEventMediaInput[];
}

export interface ExistingEventMediaInput {
  readonly filename: string;
  readonly url: string;
}

export interface UpdateEventInput {
  readonly eventId: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly date: string;
  readonly time: string;
  readonly existingMedia?: readonly ExistingEventMediaInput[];
  readonly newMedia?: readonly NewEventMediaInput[];
}
