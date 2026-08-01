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
  // Twitter/Telegram-style pin: at most one post, private to this user —
  // pinning a second post replaces it rather than allowing several at once,
  // and it never affects what any other user sees as pinned.
  readonly pinnedPostId: string | null;
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

export interface StoredMissionComment {
  readonly id: string;
  readonly missionId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface StoredMissionCommentReport {
  readonly id: string;
  readonly missionCommentId: string;
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
  // Set only when status transitions to 'done' — the digest feature needs to
  // know *when* a mission was completed to scope "completed this week",
  // which stopsDone/status alone can't answer.
  readonly completedAt: string | null;
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

export type ServiceCategory =
  | 'pet-care'
  | 'home-services'
  | 'beauty'
  | 'automotive'
  | 'pool-spa'
  | 'tech-web'
  | 'dining'
  | 'other';

export interface StoredServiceListing {
  readonly id: string;
  readonly authorId: string;
  readonly businessName: string;
  readonly category: ServiceCategory;
  readonly description: string;
  readonly contactPhone: string | null;
  readonly contactEmail: string | null;
  readonly contactWebsite: string | null;
  readonly serviceArea: string | null;
  // Free text, e.g. "Mon–Fri 8am–9pm, Sat–Sun 9am–10pm" — not a structured
  // schedule, so no "open now" logic can be derived from it.
  readonly hours: string | null;
  // A single business logo, distinct from `media` (the photo gallery) — shown
  // in place of the category's default icon wherever the listing appears
  // compactly (card, list rows).
  readonly logo?: StoredMedia;
  readonly media?: readonly StoredMedia[];
  readonly createdAt: string;
}

export interface StoredServiceReview {
  readonly id: string;
  readonly listingId: string;
  readonly authorId: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
}

export interface StoredServiceReviewReport {
  readonly id: string;
  readonly serviceReviewId: string;
  readonly reporterId: string;
  readonly createdAt: string;
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

export type BookmarkTargetType = 'post' | 'event' | 'mission' | 'service';

export interface StoredBookmark {
  readonly id: string;
  readonly userId: string;
  readonly targetType: BookmarkTargetType;
  readonly targetId: string;
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
  readonly missionComments: readonly StoredMissionComment[];
  readonly missionCommentReports: readonly StoredMissionCommentReport[];
  readonly serviceListings: readonly StoredServiceListing[];
  readonly serviceReviews: readonly StoredServiceReview[];
  readonly serviceReviewReports: readonly StoredServiceReviewReport[];
  readonly notifications: readonly StoredNotification[];
  readonly bookmarks: readonly StoredBookmark[];
  readonly users: readonly StoredUser[];
  readonly week: readonly StoredWeekDay[];
}
