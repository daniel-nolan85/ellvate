import type { RequestContext } from '@/src/backend/http';
import { getMissionsView } from '@/src/backend/missions';

import type { UserProfile } from './profile';
import { getProfile } from './profile';

export type PublicProfile = Pick<UserProfile, 'userId' | 'role' | 'interests'>;

export interface PublicMemberStats {
  readonly level: number;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
}

export interface PublicMemberSummary {
  readonly profile: PublicProfile;
  readonly stats: PublicMemberStats;
}

export async function getPublicProfile(
  ctx: RequestContext,
  memberUserId: string,
): Promise<PublicMemberSummary> {
  const memberCtx = { ...ctx, userId: memberUserId };
  const [{ profile }, missionsView] = await Promise.all([
    getProfile(memberCtx),
    getMissionsView(memberCtx),
  ]);
  const progress = missionsView.progress;

  return {
    profile: {
      interests: profile.interests,
      role: profile.role,
      userId: profile.userId,
    },
    stats: {
      level: progress?.level ?? 1,
      missionsCompleted: progress?.missionsCompleted ?? 0,
      streakDays: progress?.streakDays ?? 0,
      xp: progress?.xp ?? 0,
    },
  };
}
