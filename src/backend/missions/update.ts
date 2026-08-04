import { extractExistingMedia, extractMediaUploads } from '@/src/backend/media';
import type { RequestContext } from '@/src/backend/http';
import { getState, setState } from '@/src/backend/store';

import { toMissionView } from './mission-view';
import { updateMissionSupabase } from './missions-supabase';
import type { UpdateMissionResult } from './types';
import { validateMissionInput } from './validation';

function updateMissionMemory(
  userId: string,
  missionId: string,
  input: unknown,
): UpdateMissionResult {
  const existing = getState().missions.find((mission) => mission.id === missionId);
  if (!existing) {
    return {
      code: 'mission_not_found',
      message: 'Mission not found.',
      ok: false,
    };
  }
  if (existing.authorId !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own missions.',
      ok: false,
    };
  }
  const validation = validateMissionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const keptMedia = extractExistingMedia(input);
  const newMedia = extractMediaUploads(input);
  const media = [
    ...keptMedia,
    ...newMedia.map((upload) => ({
      filename: upload.filename,
      url: upload.dataUrl,
    })),
  ];
  const next = setState((current) => ({
    ...current,
    missions: current.missions.map((mission) =>
      mission.id === missionId
        ? {
            ...mission,
            title: value.title,
            description: value.description,
            scheduledFor: value.scheduledFor,
            xp: value.xp,
            stopsTotal: value.stopsTotal,
            stops: value.stops,
            theme: value.theme,
            media: media.length ? media : undefined,
            editedAt: new Date().toISOString(),
          }
        : mission,
    ),
  }));
  const updated = next.missions.find((mission) => mission.id === missionId);
  if (!updated) {
    return {
      code: 'mission_not_found',
      message: 'Mission not found.',
      ok: false,
    };
  }
  return { ok: true, mission: toMissionView(updated, userId, next.users) };
}

export async function updateMission(
  ctx: RequestContext,
  missionId: string,
  input: unknown,
): Promise<UpdateMissionResult> {
  return ctx.supabase
    ? updateMissionSupabase(ctx.supabase, ctx.userId, missionId, input)
    : updateMissionMemory(ctx.userId, missionId, input);
}
