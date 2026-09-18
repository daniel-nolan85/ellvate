import type { SupabaseClient } from '@supabase/supabase-js';

import type { RequestContext } from '@/src/backend/http';
import { getState } from '@/src/backend/store';
import { throwIfSupabaseError } from '@/src/services/supabase';

import type { XpGrowthPoint, XpGrowthResponse } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

// UTC Monday (not the digest module's Pacific-anchored week) of the week
// containing `iso` -- a growth chart only needs consistent, evenly-spaced
// buckets, not the digest cron's exact wall-clock alignment.
function weekStartIso(iso: string): string {
  const date = new Date(iso);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - daysSinceMonday * MS_PER_DAY);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

function addWeeks(weekStart: string, weeks: number): string {
  const date = new Date(`${weekStart}T00:00:00.000Z`);
  return new Date(date.getTime() + weeks * MS_PER_WEEK).toISOString().slice(0, 10);
}

interface GrowthSourceEntry {
  readonly amount: number;
  readonly createdAt: string;
}

// One point per week from the week BEFORE the user's first XP event (a
// fixed zero-XP anchor) through the current week, each carrying both that
// week's own total and the running sum so far. A week with no activity
// still gets a point (xpEarned: 0) so the chart shows a flat plateau
// instead of silently skipping it. The leading zero anchor exists so a
// brand-new account (all its history in a single week) still has two
// points to draw a real line between, instead of one lone dot -- without
// it, the very common "just started this week" case renders nothing
// visibly different from an empty chart.
function buildGrowthPoints(
  entries: readonly GrowthSourceEntry[],
): readonly XpGrowthPoint[] {
  if (entries.length === 0) {
    return [];
  }

  const earnedByWeek = new Map<string, number>();
  let firstWeek = weekStartIso(entries[0].createdAt);
  for (const entry of entries) {
    const week = weekStartIso(entry.createdAt);
    earnedByWeek.set(week, (earnedByWeek.get(week) ?? 0) + entry.amount);
    if (week < firstWeek) {
      firstWeek = week;
    }
  }
  const lastWeek = weekStartIso(new Date().toISOString());
  const anchorWeek = addWeeks(firstWeek, -1);

  const points: XpGrowthPoint[] = [{ cumulativeXp: 0, weekStart: anchorWeek, xpEarned: 0 }];
  let cumulativeXp = 0;
  for (let week = firstWeek; week <= lastWeek; week = addWeeks(week, 1)) {
    const xpEarned = earnedByWeek.get(week) ?? 0;
    cumulativeXp += xpEarned;
    points.push({ cumulativeXp, weekStart: week, xpEarned });
  }
  return points;
}

function getXpGrowthMemory(userId: string): XpGrowthResponse {
  const { xpLedger } = getState();
  const entries = xpLedger.filter((entry) => entry.userId === userId);
  return { points: buildGrowthPoints(entries) };
}

interface XpGrowthRow {
  readonly amount: number;
  readonly created_at: string;
}

async function getXpGrowthSupabase(
  supabase: SupabaseClient,
  userId: string,
): Promise<XpGrowthResponse> {
  const { data, error } = await supabase
    .from('xp_ledger')
    .select('amount,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load xp growth');
  const rows = (data ?? []) as unknown as XpGrowthRow[];
  return {
    points: buildGrowthPoints(
      rows.map((row) => ({ amount: row.amount, createdAt: row.created_at })),
    ),
  };
}

export async function getXpGrowth(ctx: RequestContext): Promise<XpGrowthResponse> {
  return ctx.supabase
    ? getXpGrowthSupabase(ctx.supabase, ctx.userId)
    : getXpGrowthMemory(ctx.userId);
}
