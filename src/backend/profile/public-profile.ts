import type { RequestContext } from '@/src/backend/http';
import { getState, type CommunityRole } from '@/src/backend/store';
import { getMissionsView } from '@/src/backend/missions';
import { getMutedUserIds } from '@/src/backend/mutes';

import {
  getMemberActivityCountsSupabase,
  getMemberDisplayRowsSupabase,
  getMemberRowSupabase,
} from './public-profile-supabase';

export interface PublicMemberRow {
  readonly id: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly activityVisible: boolean;
}

export interface PublicProfile {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly role: CommunityRole | null;
  readonly interests: readonly string[];
  readonly activityVisible: boolean;
}

export interface PublicMemberStats {
  readonly level: number;
  readonly xp: number;
  readonly streakDays: number;
  readonly missionsCompleted: number;
  readonly missionsCreated: number;
  readonly postsCount: number;
  readonly eventsCreated: number;
  readonly eventsAttended: number;
  readonly servicesListed: number;
  readonly petitionsStarted: number;
}

export interface MemberActivityCounts {
  readonly missionsCreated: number;
  readonly postsCount: number;
  readonly eventsCreated: number;
  readonly eventsAttended: number;
  readonly servicesListed: number;
  readonly petitionsStarted: number;
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
        activityVisible: user.profile.activityVisible,
        avatarUrl: user.avatarUrl,
        id: user.id,
        interests: user.profile.interests,
        name: user.name,
        role: user.profile.role,
      }
    : null;
}

// Discriminates whether a member's detailed activity (actual post titles,
// event names, etc. — not the aggregate figures in PublicMemberStats, which
// are always public) may be shown to someone other than the member.
export type MemberActivitySharing = 'not_found' | 'private' | 'shared';

export async function getMemberActivitySharing(
  ctx: RequestContext,
  memberUserId: string,
): Promise<MemberActivitySharing> {
  const memberRow = ctx.supabase
    ? await getMemberRowSupabase(ctx.supabase, memberUserId)
    : getMemberRowMemory(memberUserId);
  if (!memberRow) {
    return 'not_found';
  }
  return memberRow.activityVisible ? 'shared' : 'private';
}

function getMemberActivityCountsMemory(
  memberUserId: string,
): MemberActivityCounts {
  const { events, missions, petitions, posts, serviceListings } = getState();
  return {
    eventsAttended: events.filter((event) =>
      event.joinedBy.includes(memberUserId),
    ).length,
    eventsCreated: events.filter(
      (event) => event.authorId === memberUserId,
    ).length,
    missionsCreated: missions.filter(
      (mission) => mission.authorId === memberUserId,
    ).length,
    petitionsStarted: petitions.filter(
      (petition) => petition.createdBy === memberUserId,
    ).length,
    postsCount: posts.filter((post) => post.authorId === memberUserId).length,
    servicesListed: serviceListings.filter(
      (listing) => listing.authorId === memberUserId,
    ).length,
  };
}

export interface BlockedMember {
  readonly userId: string;
  readonly name: string;
  readonly avatarUrl: string | null;
}

function getBlockedMembersMemory(
  mutedUserIds: readonly string[],
): readonly BlockedMember[] {
  const { users } = getState();
  return mutedUserIds.flatMap((id) => {
    const user = users.find((candidate) => candidate.id === id);
    return user ? [{ avatarUrl: user.avatarUrl, name: user.name, userId: user.id }] : [];
  });
}

// Enriches the mutes module's raw id list with display fields, in the order
// blocked (oldest-first for memory; Supabase has no ordering guarantee to
// preserve, so callers shouldn't rely on order there).
export async function getBlockedMembers(
  ctx: RequestContext,
): Promise<readonly BlockedMember[]> {
  const mutedUserIds = await getMutedUserIds(ctx);
  if (mutedUserIds.length === 0) {
    return [];
  }
  if (!ctx.supabase) {
    return getBlockedMembersMemory(mutedUserIds);
  }
  const rows = await getMemberDisplayRowsSupabase(ctx.supabase, mutedUserIds);
  return rows.map((row) => ({
    avatarUrl: row.avatarUrl,
    name: row.name,
    userId: row.id,
  }));
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
  const [{ progress }, activityCounts] = await Promise.all([
    getMissionsView(memberCtx),
    ctx.supabase
      ? getMemberActivityCountsSupabase(ctx.supabase, memberUserId)
      : getMemberActivityCountsMemory(memberUserId),
  ]);

  return {
    profile: {
      activityVisible: memberRow.activityVisible,
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
      ...activityCounts,
    },
  };
}
