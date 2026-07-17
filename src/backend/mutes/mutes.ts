import type { RequestContext } from '@/src/backend/http';
import { ensureUser, getState, setState } from '@/src/backend/store';

import { getMutedUserIdsSupabase, toggleMuteSupabase } from './mutes-supabase';
import type { ToggleMuteResult } from './types';

function toggleMuteMemory(userId: string, mutedUserId: string): ToggleMuteResult {
  const user = ensureUser(userId);
  const alreadyMuted = user.mutedUserIds.includes(mutedUserId);
  const nextMutedUserIds = alreadyMuted
    ? user.mutedUserIds.filter((id) => id !== mutedUserId)
    : [...user.mutedUserIds, mutedUserId];

  setState((current) => ({
    ...current,
    users: current.users.map((candidate) =>
      candidate.id === userId
        ? { ...candidate, mutedUserIds: nextMutedUserIds }
        : candidate,
    ),
  }));

  return { muted: !alreadyMuted, mutedUserId };
}

function getMutedUserIdsMemory(userId: string): readonly string[] {
  return getState().users.find((user) => user.id === userId)?.mutedUserIds ?? [];
}

export async function toggleMute(
  ctx: RequestContext,
  mutedUserId: string,
): Promise<ToggleMuteResult> {
  return ctx.supabase
    ? toggleMuteSupabase(ctx.supabase, ctx.userId, mutedUserId)
    : toggleMuteMemory(ctx.userId, mutedUserId);
}

export async function getMutedUserIds(
  ctx: RequestContext,
): Promise<readonly string[]> {
  return ctx.supabase
    ? getMutedUserIdsSupabase(ctx.supabase, ctx.userId)
    : getMutedUserIdsMemory(ctx.userId);
}
