import { extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { setState, type StoredMission } from '@/src/backend/store';

import { toMissionView } from './mission-view';
import { createMissionSupabase } from './missions-supabase';
import type { CreateMissionResult } from './types';
import { validateMissionInput } from './validation';

function createMissionMemory(userId: string, input: unknown): CreateMissionResult {
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
  return ctx.supabase
    ? createMissionSupabase(ctx.supabase, ctx.userId, input)
    : createMissionMemory(ctx.userId, input);
}
