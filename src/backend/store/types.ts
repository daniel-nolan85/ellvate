export type MissionStatus = 'active' | 'done' | 'locked';
export type MissionIcon = 'Sun' | 'ArrowUp' | 'Star' | 'Moon';
export type CommunityRole = 'resident' | 'new' | 'business' | 'visitor';
export type AiComfortLevel = 'new' | 'casual' | 'power';

export interface NotificationPrefs {
  readonly events: boolean;
  readonly replies: boolean;
  readonly missions: boolean;
  readonly digest: boolean;
}

export interface StoredProfile {
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly aiComfort: AiComfortLevel | null;
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
}

export interface StoredUser {
  readonly id: string;
  readonly name: string;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly previousRank: number | null;
  readonly title: string;
  readonly profile: StoredProfile;
}

export interface StoredPost {
  readonly id: string;
  readonly forum: string;
  readonly authorId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly replies: number;
  readonly likes: number;
  readonly likedBy: readonly string[];
  readonly pinned: boolean;
}

export interface StoredEvent {
  readonly id: string;
  readonly startsAt: string;
  readonly timeLabel: string;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly featured: boolean;
  readonly going: number;
  readonly joinedBy: readonly string[];
  readonly attendeeIds: readonly string[];
}

export interface MissionUserProgress {
  readonly status: MissionStatus;
  readonly stopsDone: number;
}

export interface StoredMission {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly xp: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
  readonly progressByUser: Readonly<Record<string, MissionUserProgress>>;
}

export interface StoredWeekDay {
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly date: string;
  readonly isToday: boolean;
}

export interface StoreState {
  readonly subforums: readonly string[];
  readonly posts: readonly StoredPost[];
  readonly events: readonly StoredEvent[];
  readonly missions: readonly StoredMission[];
  readonly users: readonly StoredUser[];
  readonly week: readonly StoredWeekDay[];
}
