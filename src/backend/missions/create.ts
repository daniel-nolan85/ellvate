import { extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { setState, type StoredMission } from '@/src/backend/store';
import { CREATE_CONTENT_XP, grantXp, NO_XP_AWARD } from '@/src/backend/xp';

import { toMissionView } from './mission-view';
import { createMissionSupabase } from './missions-supabase';
import type { CreatedMissionResult, CreateMissionResult } from './types';
import { validateMissionInput } from './validation';

function createMissionMemory(userId: string, input: unknown): CreatedMissionResult {
  const validation = validateMissionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const mediaUploads = extractMediaUploads(input);
  const stored: StoredMission = {
    id: `msn-${crypto.randomUUID()}`,
    authorId: userId,
    title: value.title,
    description: value.description,
    scheduledFor: value.scheduledFor,
    xp: value.xp,
    stopsTotal: value.stopsTotal,
    stops: value.stops,
    theme: value.theme,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    progressByUser: {},
    editedAt: null,
  };
  const next = setState((current) => ({
    ...current,
    missions: [...current.missions, stored],
  }));
  return { ok: true, mission: toMissionView(stored, userId, next.users) };
}

export async function createMission(
  ctx: RequestContext,
  input: unknown,
): Promise<CreateMissionResult> {
  const result = ctx.supabase
    ? await createMissionSupabase(ctx.supabase, ctx.userId, input)
    : createMissionMemory(ctx.userId, input);

  if (!result.ok) {
    return result;
  }

  // The mission is already fully saved by this point -- a failure in this
  // purely secondary XP grant must never make an otherwise-successful
  // mission creation look like it failed to the client.
  const xpAward = await grantXp(ctx, {
    amount: CREATE_CONTENT_XP,
    reason: 'mission_created',
    refId: result.mission.id,
  }).catch(() => NO_XP_AWARD);

  return { ...result, xpAward };
}
