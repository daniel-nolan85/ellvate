import type { SupabaseClient } from '@supabase/supabase-js';

import { throwIfSupabaseError } from '@/src/services/supabase';

import type { DigestCompletedMission, DigestRawData } from './types';

const COMING_UP_LIMIT = 3;

interface PostRow {
  readonly id: string;
  readonly like_count: number;
  readonly reply_count: number;
  readonly author_id: string;
}

interface EventRow {
  readonly id: string;
  readonly going_base: number;
  readonly created_by: string;
}

interface UpcomingEventRow {
  readonly id: string;
  readonly title: string;
  readonly day_label: string;
  readonly date_label: string;
  readonly time_label: string;
}

interface UpcomingMissionRow {
  readonly id: string;
  readonly title: string;
  readonly scheduled_for: string;
}

interface CompletedProgressRow {
  readonly mission_id: string;
  readonly user_id: string;
}

interface MissionSummaryRow {
  readonly id: string;
  readonly title: string;
  readonly xp: number;
}

export async function getWeeklyDigestRawSupabase(
  supabase: SupabaseClient,
  start: Date,
  end: Date,
  upcomingStart: Date,
  upcomingEnd: Date,
): Promise<DigestRawData> {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const upcomingStartIso = upcomingStart.toISOString();
  const upcomingEndIso = upcomingEnd.toISOString();
  const upcomingStartDate = upcomingStartIso.slice(0, 10);
  const upcomingEndDate = upcomingEndIso.slice(0, 10);

  const [postsRes, eventsRes, completedProgressRes, commentsRes] = await Promise.all([
    supabase
      .from('posts')
      .select('id,like_count,reply_count,author_id')
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('events')
      .select('id,going_base,created_by')
      .gte('starts_at', startIso)
      .lt('starts_at', endIso),
    supabase
      .from('mission_progress')
      .select('mission_id,user_id')
      .eq('status', 'done')
      .gte('completed_at', startIso)
      .lt('completed_at', endIso),
    supabase.from('comments').select('author_id').gte('created_at', startIso).lt('created_at', endIso),
  ]);
  throwIfSupabaseError(postsRes.error, 'load digest posts');
  throwIfSupabaseError(eventsRes.error, 'load digest events');
  throwIfSupabaseError(completedProgressRes.error, 'load digest mission completions');
  throwIfSupabaseError(commentsRes.error, 'load digest comments');

  const postRows = (postsRes.data ?? []) as unknown as PostRow[];
  const eventRows = (eventsRes.data ?? []) as unknown as EventRow[];
  const completedRows = (completedProgressRes.data ?? []) as unknown as CompletedProgressRow[];
  const commentRows = (commentsRes.data ?? []) as { author_id: string }[];

  const eventIds = eventRows.map((row) => row.id);
  const joinsRes = eventIds.length
    ? await supabase.from('event_joins').select('event_id,user_id').in('event_id', eventIds)
    : { data: [] as { event_id: string; user_id: string }[], error: null };
  throwIfSupabaseError(joinsRes.error, 'load digest event joins');
  const joinRows = (joinsRes.data ?? []) as { event_id: string; user_id: string }[];
  const goingCountFor = (eventId: string): number =>
    joinRows.filter((row) => row.event_id === eventId).length;

  const missionIds = [...new Set(completedRows.map((row) => row.mission_id))];
  const missionsRes = missionIds.length
    ? await supabase.from('missions').select('id,title,xp').in('id', missionIds)
    : { data: [] as MissionSummaryRow[], error: null };
  throwIfSupabaseError(missionsRes.error, 'load digest completed missions');
  const missionById = new Map(
    ((missionsRes.data ?? []) as unknown as MissionSummaryRow[]).map((row) => [row.id, row]),
  );

  const completedByMission = new Map<string, DigestCompletedMission>();
  for (const row of completedRows) {
    const mission = missionById.get(row.mission_id);
    if (!mission) {
      continue;
    }
    const existing = completedByMission.get(row.mission_id);
    completedByMission.set(row.mission_id, {
      completedByCount: (existing?.completedByCount ?? 0) + 1,
      id: mission.id,
      title: mission.title,
      xp: mission.xp,
    });
  }

  const activeMemberIds = new Set<string>([
    ...postRows.map((row) => row.author_id),
    ...eventRows.map((row) => row.created_by),
    ...completedRows.map((row) => row.user_id),
    ...commentRows.map((row) => row.author_id),
  ]);

  const [upcomingEventsRes, upcomingMissionsRes] = await Promise.all([
    supabase
      .from('events')
      .select('id,title,day_label,date_label,time_label')
      .gte('starts_at', upcomingStartIso)
      .lt('starts_at', upcomingEndIso)
      .order('starts_at', { ascending: true })
      .limit(COMING_UP_LIMIT),
    supabase
      .from('missions')
      .select('id,title,scheduled_for')
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', upcomingStartDate)
      .lt('scheduled_for', upcomingEndDate)
      .order('scheduled_for', { ascending: true })
      .limit(COMING_UP_LIMIT),
  ]);
  throwIfSupabaseError(upcomingEventsRes.error, 'load digest upcoming events');
  throwIfSupabaseError(upcomingMissionsRes.error, 'load digest upcoming missions');

  return {
    activeMemberCount: activeMemberIds.size,
    comingUpEvents: ((upcomingEventsRes.data ?? []) as unknown as UpcomingEventRow[]).map(
      (row) => ({
        dateLabel: row.date_label,
        dayLabel: row.day_label,
        id: row.id,
        timeLabel: row.time_label,
        title: row.title,
      }),
    ),
    comingUpMissions: ((upcomingMissionsRes.data ?? []) as unknown as UpcomingMissionRow[]).map(
      (row) => ({ id: row.id, scheduledFor: row.scheduled_for, title: row.title }),
    ),
    completedMissions: [...completedByMission.values()].sort(
      (a, b) => b.completedByCount - a.completedByCount,
    ),
    eventCandidates: eventRows.map((row) => ({
      going: row.going_base + goingCountFor(row.id),
      id: row.id,
    })),
    eventCount: eventRows.length,
    missionsCompletedCount: completedRows.length,
    postCandidates: postRows.map((row) => ({
      id: row.id,
      likes: row.like_count,
      replies: row.reply_count,
    })),
    postCount: postRows.length,
  };
}
