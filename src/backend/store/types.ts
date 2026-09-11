import type { ReportReason } from '@/src/lib/report-reasons';

export type MissionStatus = 'active' | 'done';
export type MissionTheme = 'trail' | 'water' | 'village' | 'day' | 'night' | 'social';
export type CommunityRole = 'resident' | 'new' | 'business' | 'visitor';
export type XpReason =
  | 'mission_completed'
  | 'mission_created'
  | 'post_created'
  | 'event_created'
  | 'service_created'
  | 'onboarding_bonus';

export interface NotificationPrefs {
  readonly events: boolean;
  readonly replies: boolean;
  readonly missions: boolean;
  readonly digest: boolean;
  readonly petitions: boolean;
}

export interface StoredProfile {
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly notificationPrefs: NotificationPrefs;
  readonly onboardedAt: string | null;
  // Opt-in: when false (the default), other members see only aggregate
  // activity figures on this user's profile — no drill-down into their
  // actual posts/events/missions/services.
  readonly activityVisible: boolean;
}

export interface StoredUser {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  // Community admin -- distinct from dashboard_admins, which only gates
  // login to the separate /admin moderation tool. Drives the "admin" mark
  // shown next to this user's name on their own content.
  readonly isAdmin: boolean;
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
  // Null until the author edits the post at least once.
  readonly editedAt: string | null;
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
  readonly editedAt: string | null;
}

export interface StoredPostReport {
  readonly id: string;
  readonly postId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredCommentReport {
  readonly id: string;
  readonly commentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredEventComment {
  readonly id: string;
  readonly eventId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface StoredEventCommentReport {
  readonly id: string;
  readonly eventCommentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredMissionComment {
  readonly id: string;
  readonly missionId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface StoredMissionCommentReport {
  readonly id: string;
  readonly missionCommentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredMissionCheckIn {
  readonly id: string;
  readonly missionId: string;
  readonly userId: string;
  readonly stopIndex: number;
  readonly completedAt: string;
  readonly photoUrl: string | null;
}

export interface StoredMissionCheckInReport {
  readonly id: string;
  readonly checkInId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
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
  // Null until the author edits the event at least once.
  readonly editedAt: string | null;
}

export interface StoredEventReport {
  readonly id: string;
  readonly eventId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
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
  // Always equal to stops.length — never picked directly, only derived at
  // write time — but kept as its own field since it's read far more often
  // than stops itself (progress bars, "X/Y stops" labels).
  readonly stopsTotal: number;
  readonly stops: readonly string[];
  readonly theme: MissionTheme | null;
  readonly media?: readonly StoredMedia[];
  readonly progressByUser: Readonly<Record<string, MissionUserProgress>>;
  // Null until the author edits the mission at least once.
  readonly editedAt: string | null;
}

export interface StoredMissionReport {
  readonly id: string;
  readonly missionId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
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
  // Null until the author edits the listing at least once.
  readonly editedAt: string | null;
}

export interface StoredServiceReview {
  readonly id: string;
  readonly listingId: string;
  readonly authorId: string;
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly body: string | null;
  readonly createdAt: string;
  // Null until the author edits the review at least once.
  readonly editedAt: string | null;
}

export interface StoredServiceReviewReport {
  readonly id: string;
  readonly serviceReviewId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
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

export type ContactMessageCategory = 'bug' | 'feedback' | 'question' | 'other';

export interface StoredContactMessage {
  readonly id: string;
  readonly userId: string;
  readonly category: ContactMessageCategory;
  readonly message: string;
  readonly createdAt: string;
}

export type PetitionCategory =
  | 'safety'
  | 'maintenance'
  | 'amenities'
  | 'landscaping'
  | 'traffic-parking'
  | 'noise-nuisance'
  | 'other';

export type PetitionStatus = 'open' | 'succeeded' | 'expired';

export interface StoredPetition {
  readonly id: string;
  readonly createdBy: string;
  readonly title: string;
  readonly description: string;
  readonly category: PetitionCategory;
  readonly deadlineDays: 7 | 14 | 30 | 60 | 90;
  readonly deadlineAt: string;
  readonly requiredSignatures: number;
  readonly signatureCount: number;
  readonly status: PetitionStatus;
  readonly succeededAt: string | null;
  readonly hoaEmailSentAt: string | null;
  readonly hoaResponse: string | null;
  readonly hoaResponseAt: string | null;
  readonly createdAt: string;
  readonly media?: readonly StoredMedia[];
}

export interface StoredPetitionSignature {
  readonly petitionId: string;
  readonly userId: string;
  readonly createdAt: string;
}

export interface StoredPetitionComment {
  readonly id: string;
  readonly petitionId: string;
  readonly authorId: string;
  readonly body: string;
  readonly createdAt: string;
  readonly editedAt: string | null;
}

export interface StoredPetitionReport {
  readonly id: string;
  readonly petitionId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredPetitionCommentReport {
  readonly id: string;
  readonly petitionCommentId: string;
  readonly reporterId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredMemberReport {
  readonly id: string;
  readonly reporterId: string;
  readonly reportedUserId: string;
  readonly createdAt: string;
  readonly reason: ReportReason | null;
  readonly details: string | null;
  readonly evidenceImageUrl: string | null;
}

export interface StoredXpLedgerEntry {
  readonly id: string;
  readonly userId: string;
  readonly amount: number;
  readonly reason: XpReason;
  readonly refId: string | null;
  readonly createdAt: string;
}

export type BookmarkTargetType = 'post' | 'event' | 'mission' | 'service' | 'petition';

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
  readonly eventReports: readonly StoredEventReport[];
  readonly missions: readonly StoredMission[];
  readonly missionComments: readonly StoredMissionComment[];
  readonly missionCommentReports: readonly StoredMissionCommentReport[];
  readonly missionReports: readonly StoredMissionReport[];
  readonly missionCheckIns: readonly StoredMissionCheckIn[];
  readonly missionCheckInReports: readonly StoredMissionCheckInReport[];
  readonly serviceListings: readonly StoredServiceListing[];
  readonly serviceReviews: readonly StoredServiceReview[];
  readonly serviceReviewReports: readonly StoredServiceReviewReport[];
  readonly notifications: readonly StoredNotification[];
  readonly contactMessages: readonly StoredContactMessage[];
  readonly petitions: readonly StoredPetition[];
  readonly petitionSignatures: readonly StoredPetitionSignature[];
  readonly petitionComments: readonly StoredPetitionComment[];
  readonly petitionReports: readonly StoredPetitionReport[];
  readonly petitionCommentReports: readonly StoredPetitionCommentReport[];
  readonly bookmarks: readonly StoredBookmark[];
  readonly memberReports: readonly StoredMemberReport[];
  readonly xpLedger: readonly StoredXpLedgerEntry[];
  readonly users: readonly StoredUser[];
  readonly week: readonly StoredWeekDay[];
}
