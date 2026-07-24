import type { CommunityEvent } from '@/src/backend/events';
import type { ForumPost } from '@/src/backend/forum';

export interface DigestStats {
  readonly newPosts: number;
  readonly eventsHeld: number;
  readonly missionsCompleted: number;
  readonly activeMembers: number;
}

export interface DigestCompletedMission {
  readonly id: string;
  readonly title: string;
  readonly xp: number;
  readonly completedByCount: number;
}

export interface DigestUpcomingEvent {
  readonly id: string;
  readonly title: string;
  readonly dayLabel: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
}

export interface DigestUpcomingMission {
  readonly id: string;
  readonly title: string;
  readonly scheduledFor: string;
}

export interface WeeklyDigest {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly stats: DigestStats;
  readonly popularPosts: readonly ForumPost[];
  readonly popularEvents: readonly CommunityEvent[];
  readonly completedMissions: readonly DigestCompletedMission[];
  readonly comingUpEvents: readonly DigestUpcomingEvent[];
  readonly comingUpMissions: readonly DigestUpcomingMission[];
}

export interface GetWeeklyDigestOptions {
  readonly weekStart?: string;
}

// Internal shape shared between the memory and Supabase raw-data fetchers —
// just enough to rank candidates before the shared orchestrator hydrates the
// winners via getPostsByIds/getEventsByIds.
export interface DigestRawPostCandidate {
  readonly id: string;
  readonly likes: number;
  readonly replies: number;
}

export interface DigestRawEventCandidate {
  readonly id: string;
  readonly going: number;
}

export interface DigestRawData {
  readonly postCount: number;
  readonly eventCount: number;
  readonly activeMemberCount: number;
  readonly postCandidates: readonly DigestRawPostCandidate[];
  readonly eventCandidates: readonly DigestRawEventCandidate[];
  readonly completedMissions: readonly DigestCompletedMission[];
  readonly missionsCompletedCount: number;
  readonly comingUpEvents: readonly DigestUpcomingEvent[];
  readonly comingUpMissions: readonly DigestUpcomingMission[];
}
