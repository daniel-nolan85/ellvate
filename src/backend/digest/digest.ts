import { getEventsByIds } from '@/src/backend/events';
import { getPostsByIds } from '@/src/backend/forum';
import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';

import { getWeeklyDigestRawSupabase } from './digest-supabase';
import type {
  DigestCompletedMission,
  DigestRawData,
  GetWeeklyDigestOptions,
  WeeklyDigest,
} from './types';
import { isWithin, nextSevenDaysBounds, resolveWeekBounds } from './week-bounds';

const POPULAR_LIMIT = 5;
const COMING_UP_LIMIT = 3;

// Likes count double a comment's weight — a simple, explainable engagement
// score rather than a tuned ranking model, matching how "popular" only needs
// to be a reasonable ordering for a weekly recap, not a precise metric.
const engagementScore = (post: DigestRawData['postCandidates'][number]): number =>
  post.likes + 2 * post.replies;

function topN<T>(items: readonly T[], score: (item: T) => number, limit: number): readonly T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

function getWeeklyDigestRawMemory(start: Date, end: Date): DigestRawData {
  const state = getState();

  const weekPosts = state.posts.filter((post) => isWithin(post.createdAt, start, end));
  const weekEvents = state.events.filter((event) => isWithin(event.startsAt, start, end));
  const completions = state.missions.flatMap((mission) =>
    Object.entries(mission.progressByUser)
      .filter(
        ([, progress]) =>
          progress.status === 'done' &&
          progress.completedAt !== null &&
          isWithin(progress.completedAt, start, end),
      )
      .map(([userId]) => ({ mission, userId })),
  );

  const activeMemberIds = new Set<string>([
    ...weekPosts.map((post) => post.authorId),
    ...weekEvents.map((event) => event.authorId),
    ...completions.map((entry) => entry.userId),
    ...state.comments
      .filter((comment) => isWithin(comment.createdAt, start, end))
      .map((comment) => comment.authorId),
  ]);

  const completedByMission = new Map<string, DigestCompletedMission>();
  for (const entry of completions) {
    const existing = completedByMission.get(entry.mission.id);
    completedByMission.set(entry.mission.id, {
      completedByCount: (existing?.completedByCount ?? 0) + 1,
      id: entry.mission.id,
      title: entry.mission.title,
      xp: entry.mission.xp,
    });
  }

  const upcoming = nextSevenDaysBounds();
  const comingUpEvents = [...state.events]
    .filter((event) => isWithin(event.startsAt, upcoming.start, upcoming.end))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, COMING_UP_LIMIT)
    .map((event) => ({
      dateLabel: event.dateLabel,
      dayLabel: event.dayLabel,
      id: event.id,
      timeLabel: event.timeLabel,
      title: event.title,
    }));
  const upcomingStartDate = upcoming.start.toISOString().slice(0, 10);
  const upcomingEndDate = upcoming.end.toISOString().slice(0, 10);
  const comingUpMissions = [...state.missions]
    .filter(
      (mission) =>
        mission.scheduledFor !== null &&
        mission.scheduledFor >= upcomingStartDate &&
        mission.scheduledFor < upcomingEndDate,
    )
    .sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
    .slice(0, COMING_UP_LIMIT)
    .map((mission) => ({
      id: mission.id,
      scheduledFor: mission.scheduledFor ?? '',
      title: mission.title,
    }));

  return {
    activeMemberCount: activeMemberIds.size,
    comingUpEvents,
    comingUpMissions,
    completedMissions: [...completedByMission.values()].sort(
      (a, b) => b.completedByCount - a.completedByCount,
    ),
    eventCandidates: weekEvents.map((event) => ({ going: event.going, id: event.id })),
    eventCount: weekEvents.length,
    missionsCompletedCount: completions.length,
    postCandidates: weekPosts.map((post) => ({
      id: post.id,
      likes: post.likes,
      replies: post.replies,
    })),
    postCount: weekPosts.length,
  };
}

// getPostsByIds/getEventsByIds don't guarantee they preserve input order (and
// may return fewer items than requested if hydration drops a target, e.g. a
// muted author's post) — re-sort hydrated results back into rank order.
function reorderById<T extends { readonly id: string }>(
  items: readonly T[],
  orderedIds: readonly string[],
): readonly T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

export async function getWeeklyDigest(
  ctx: RequestContext,
  options?: GetWeeklyDigestOptions,
): Promise<WeeklyDigest> {
  const { end, start, weekEndIso, weekStartIso } = resolveWeekBounds(options?.weekStart);
  const upcoming = nextSevenDaysBounds();

  const raw = ctx.supabase
    ? await getWeeklyDigestRawSupabase(ctx.supabase, start, end, upcoming.start, upcoming.end)
    : getWeeklyDigestRawMemory(start, end);

  const popularPostIds = topN(raw.postCandidates, engagementScore, POPULAR_LIMIT).map(
    (post) => post.id,
  );
  const popularEventIds = topN(raw.eventCandidates, (event) => event.going, POPULAR_LIMIT).map(
    (event) => event.id,
  );

  const [popularPosts, popularEvents] = await Promise.all([
    getPostsByIds(ctx, popularPostIds),
    getEventsByIds(ctx, popularEventIds),
  ]);

  return {
    comingUpEvents: raw.comingUpEvents,
    comingUpMissions: raw.comingUpMissions,
    completedMissions: raw.completedMissions,
    popularEvents: reorderById(popularEvents, popularEventIds),
    popularPosts: reorderById(popularPosts, popularPostIds),
    stats: {
      activeMembers: raw.activeMemberCount,
      eventsHeld: raw.eventCount,
      missionsCompleted: raw.missionsCompletedCount,
      newPosts: raw.postCount,
    },
    weekEnd: weekEndIso,
    weekStart: weekStartIso,
  };
}
