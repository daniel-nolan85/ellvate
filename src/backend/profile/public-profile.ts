import type { RequestContext } from '@/src/backend/http';
import { getState, type CommunityRole } from '@/src/backend/store';
import { getMissionsView } from '@/src/backend/missions';

import { getMemberRowSupabase } from './public-profile-supabase';

export interface PublicMemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
}

export interface PublicProfile {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
}

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

// Read-only: looks up the member's existing row directly. Never creates one —
// unlike routing through getProfile()/ensureUser(), which would attempt an
// insert for memberUserId while still authenticated as the requester, either
// violating RLS (Supabase) or silently creating a ghost user (memory mode).
function getMemberRowMemory(memberUserId: string): PublicMemberRow | null {
  const user = getState().users.find((candidate) => candidate.id === memberUserId);
  return user
    ? {
        avatarUrl: user.avatarUrl,
        id: user.id,
        interests: user.profile.interests,
        name: user.name,
        role: user.profile.role,
      }
    : null;
}

export async function getPublicProfile(
  ctx: RequestContext,
  memberUserId: string,
): Promise<PublicMemberSummary | null> {
  const memberRow = ctx.supabase
    ? await getMemberRowSupabase(ctx.supabase, memberUserId)
    : getMemberRowMemory(memberUserId);
  if (!memberRow) {
    return null;
  }

  const memberCtx = { ...ctx, userId: memberUserId };
  const { progress } = await getMissionsView(memberCtx);

  return {
    profile: {
      avatarUrl: memberRow.avatarUrl,
      interests: memberRow.interests,
      name: memberRow.name,
      role: memberRow.role,
      userId: memberRow.id,
    },
    stats: {
      level: progress?.level ?? 1,
      missionsCompleted: progress?.missionsCompleted ?? 0,
      streakDays: progress?.streakDays ?? 0,
      xp: progress?.xp ?? 0,
    },
  };
}
