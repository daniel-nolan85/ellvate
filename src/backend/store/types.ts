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
  readonly avatarUrl: string | null;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly previousRank: number | null;
  readonly title: string;
  readonly profile: StoredProfile;
  readonly mutedUserIds: readonly string[];
}

export interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

export interface StoredPost {
  readonly id: string;
  readonly forum: string;
  readonly authorId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly excerpt: string;
  readonly media?: readonly StoredMedia[];
  readonly replies: number;
  readonly likes: number;
  readonly likedBy: readonly string[];
  readonly pinned: boolean;
}

export interface StoredComment {
  readonly id: string;
  readonly postId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface StoredPostReport {
  readonly id: string;
  readonly postId: string;
  readonly reporterId: string;
  readonly createdAt: string;
}

export interface StoredCommentReport {
  readonly id: string;
  readonly commentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
}

export interface StoredEventComment {
  readonly id: string;
  readonly eventId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface StoredEventCommentReport {
  readonly id: string;
  readonly eventCommentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
}

export interface StoredEvent {
  readonly id: string;
  readonly authorId: string;
  readonly startsAt: string;
  readonly timeLabel: string;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly title: string;
  readonly place: string;
  readonly tag: string;
  readonly media?: readonly StoredMedia[];
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
  readonly authorId: string;
  readonly title: string;
  readonly description: string;
  readonly scheduledFor: string | null;
  readonly xp: number;
  readonly stopsTotal: number;
  readonly icon: MissionIcon;
  readonly media?: readonly StoredMedia[];
  readonly progressByUser: Readonly<Record<string, MissionUserProgress>>;
}

export interface StoredWeekDay {
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly date: string;
  readonly isToday: boolean;
}

export interface StoredNotification {
  readonly id: string;
  readonly userId: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface StoreState {
  readonly subforums: readonly string[];
  readonly posts: readonly StoredPost[];
  readonly comments: readonly StoredComment[];
  readonly postReports: readonly StoredPostReport[];
  readonly commentReports: readonly StoredCommentReport[];
  readonly events: readonly StoredEvent[];
  readonly eventComments: readonly StoredEventComment[];
  readonly eventCommentReports: readonly StoredEventCommentReport[];
  readonly missions: readonly StoredMission[];
  readonly notifications: readonly StoredNotification[];
  readonly users: readonly StoredUser[];
  readonly week: readonly StoredWeekDay[];
}
