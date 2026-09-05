import type { RequestContext } from '@/src/backend/http';
import { extractMediaUploads } from '@/src/backend/media';
import { createNotificationMemory } from '@/src/backend/notifications';
import {
  getState,
  setState,
  type PetitionStatus,
  type StoredPetition,
  type StoredUser,
} from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';

import type { ValidReportSubmission } from '../reports/report-submission';
import { countAppUsers } from './gate';
import {
  createPetitionSupabase,
  getMyPetitionsViewSupabase,
  getPetitionsByIdsSupabase,
  getPetitionSupabase,
  listPetitionsPageSupabase,
  reportPetitionSupabase,
  toggleSignatureSupabase,
} from './petitions-supabase';
import type {
  CreatePetitionResult,
  ListPetitionsOptions,
  MyPetitionsOptions,
  MyPetitionsPage,
  PersonRef,
  Petition,
  PetitionsGate,
  PetitionsPage,
  ReportPetitionResult,
  ToggleSignatureOutcome,
} from './types';
import { computeRequiredSignatures, PETITIONS_UNLOCK_MIN_USERS } from './types';
import { validatePetitionInput } from './validation';

export const DEFAULT_PETITIONS_PAGE_SIZE = 20;
export const MAX_PETITIONS_PAGE_SIZE = 50;
export const DEFAULT_MY_PETITIONS_PAGE_SIZE = 20;
export const MAX_MY_PETITIONS_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// In-memory backend (tests / no-DB dev)
// ---------------------------------------------------------------------------

const toPersonRef = (users: readonly StoredUser[], id: string): PersonRef => {
  const user = users.find((candidate) => candidate.id === id);
  return user
    ? { avatarUrl: user.avatarUrl, id: user.id, isAdmin: user.isAdmin, name: user.name }
    : { avatarUrl: null, id, isAdmin: false, name: 'Former member' };
};

// `signedBy` is the set of PETITION ids the requesting user has signed (see
// callers: filtered to that user's own signatures, then mapped to
// petitionId) -- so membership is checked against `stored.id`, not against
// `userId` itself. Checking `signedBy.has(userId)` here was the bug: it
// compared a set of petition ids against a user id, which can never match,
// so listPetitionsPage/getPetition always reported `signed: false` in
// memory mode regardless of whether the user had actually signed.
const toPetition = (
  stored: StoredPetition,
  users: readonly StoredUser[],
  signedBy: ReadonlySet<string>,
): Petition => ({
  category: stored.category,
  createdAt: stored.createdAt,
  createdBy: toPersonRef(users, stored.createdBy),
  deadlineAt: stored.deadlineAt,
  deadlineDays: stored.deadlineDays,
  description: stored.description,
  hoaResponse: stored.hoaResponse,
  hoaResponseAt: stored.hoaResponseAt,
  id: stored.id,
  media: stored.media,
  requiredSignatures: stored.requiredSignatures,
  signatureCount: stored.signatureCount,
  signed: signedBy.has(stored.id),
  status: stored.status,
  succeededAt: stored.succeededAt,
  title: stored.title,
});

function listPetitionsPageMemory(
  userId: string,
  status: PetitionStatus | undefined,
  limit: number,
  cursor: string | null,
): PetitionsPage {
  const { petitions, petitionSignatures, users } = getState();
  const viewer = users.find((user) => user.id === userId);
  const mutedUserIds = new Set(viewer?.mutedUserIds ?? []);
  const wantedStatus = status ?? 'open';
  const filtered = petitions
    .filter((petition) => petition.status === wantedStatus)
    .filter((petition) => !mutedUserIds.has(petition.createdBy))
    .map((petition) => ({ id: petition.id, petition, sortKey: petition.createdAt }));
  const page = paginateInMemory(filtered, limit, cursor);
  const signedByUser = new Set(
    petitionSignatures.filter((sig) => sig.userId === userId).map((sig) => sig.petitionId),
  );

  return {
    nextCursor: page.nextCursor,
    petitions: page.items.map((item) => toPetition(item.petition, users, signedByUser)),
  };
}

// Fetches specific petitions by id — used to hydrate bookmarks, which can
// point at any petition regardless of status or authorship.
function getPetitionsByIdsMemory(
  userId: string,
  ids: readonly string[],
): readonly Petition[] {
  const { petitions, petitionSignatures, users } = getState();
  const idSet = new Set(ids);
  const signedByUser = new Set(
    petitionSignatures.filter((sig) => sig.userId === userId).map((sig) => sig.petitionId),
  );
  return petitions
    .filter((petition) => idSet.has(petition.id))
    .map((petition) => toPetition(petition, users, signedByUser));
}

// The activity hub — petitions the caller started or signed, mirroring
// getMyEventsViewMemory's created-or-joined precedent.
function getMyPetitionsViewMemory(
  userId: string,
  limit: number,
  cursor: string | null,
): MyPetitionsPage {
  const { petitions, petitionSignatures, users } = getState();
  const signedIds = new Set(
    petitionSignatures.filter((sig) => sig.userId === userId).map((sig) => sig.petitionId),
  );
  const mine = petitions
    .filter((petition) => petition.createdBy === userId || signedIds.has(petition.id))
    .map((petition) => ({ id: petition.id, petition, sortKey: petition.createdAt }));
  const page = paginateInMemory(mine, limit, cursor);

  return {
    nextCursor: page.nextCursor,
    petitions: page.items.map((item) => toPetition(item.petition, users, signedIds)),
  };
}

function getPetitionMemory(petitionId: string, userId: string): Petition | null {
  const { petitions, petitionSignatures, users } = getState();
  const petition = petitions.find((candidate) => candidate.id === petitionId);
  if (!petition) {
    return null;
  }
  const signedByUser = new Set(
    petitionSignatures.filter((sig) => sig.userId === userId).map((sig) => sig.petitionId),
  );
  return toPetition(petition, users, signedByUser);
}

function createPetitionMemory(userId: string, input: unknown): CreatePetitionResult {
  const totalUsers = getState().users.length;
  if (totalUsers < PETITIONS_UNLOCK_MIN_USERS) {
    return {
      code: 'petitions_locked',
      message: 'Petitions unlock once the community is larger.',
      ok: false,
    };
  }
  const validation = validatePetitionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  const now = new Date();
  const deadlineAt = new Date(now.getTime() + value.deadlineDays * 24 * 60 * 60 * 1000).toISOString();
  const mediaUploads = extractMediaUploads(input);
  const stored: StoredPetition = {
    category: value.category,
    createdAt: now.toISOString(),
    createdBy: userId,
    deadlineAt,
    deadlineDays: value.deadlineDays,
    description: value.description,
    hoaEmailSentAt: null,
    hoaResponse: null,
    hoaResponseAt: null,
    id: `petition-${crypto.randomUUID()}`,
    media: mediaUploads.length
      ? mediaUploads.map((upload) => ({
          filename: upload.filename,
          url: upload.dataUrl,
        }))
      : undefined,
    requiredSignatures: computeRequiredSignatures(totalUsers),
    signatureCount: 0,
    status: 'open',
    succeededAt: null,
    title: value.title,
  };
  const next = setState((current) => ({
    ...current,
    petitions: [stored, ...current.petitions],
  }));
  return { ok: true, petition: toPetition(stored, next.users, new Set()) };
}

function toggleSignatureMemory(userId: string, petitionId: string): ToggleSignatureOutcome {
  const state = getState();
  const petition = state.petitions.find((candidate) => candidate.id === petitionId);
  if (!petition) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  const alreadySigned = state.petitionSignatures.some(
    (sig) => sig.petitionId === petitionId && sig.userId === userId,
  );

  if (alreadySigned) {
    const next = setState((current) => {
      const updatedCount = Math.max(0, petition.signatureCount - 1);
      return {
        ...current,
        petitionSignatures: current.petitionSignatures.filter(
          (sig) => !(sig.petitionId === petitionId && sig.userId === userId),
        ),
        petitions: current.petitions.map((candidate) =>
          candidate.id === petitionId ? { ...candidate, signatureCount: updatedCount } : candidate,
        ),
      };
    });
    const updated = next.petitions.find((candidate) => candidate.id === petitionId);
    if (!updated) {
      return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
    }
    return {
      ok: true,
      result: {
        id: petitionId,
        justSucceeded: false,
        signatureCount: updated.signatureCount,
        signed: false,
        status: updated.status,
      },
    };
  }

  if (petition.status !== 'open') {
    return {
      code: 'petition_not_open',
      message: 'This petition is no longer open for signatures.',
      ok: false,
    };
  }

  const newCount = petition.signatureCount + 1;
  const justSucceeded = newCount >= petition.requiredSignatures;
  const next = setState((current) => ({
    ...current,
    petitionSignatures: [
      ...current.petitionSignatures,
      { createdAt: new Date().toISOString(), petitionId, userId },
    ],
    petitions: current.petitions.map((candidate) =>
      candidate.id === petitionId
        ? {
            ...candidate,
            signatureCount: newCount,
            status: justSucceeded ? 'succeeded' : candidate.status,
            succeededAt: justSucceeded ? new Date().toISOString() : candidate.succeededAt,
          }
        : candidate,
    ),
  }));
  const updated = next.petitions.find((candidate) => candidate.id === petitionId);
  if (!updated) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }

  // Mirrors the Supabase notify_petition_signers trigger -- fan out to every
  // signer (including this one) when the petition just succeeded.
  if (justSucceeded) {
    const signerIds = next.petitionSignatures
      .filter((sig) => sig.petitionId === petitionId)
      .map((sig) => sig.userId);
    for (const signerId of signerIds) {
      createNotificationMemory(
        signerId,
        'petition',
        'Petition succeeded',
        `"${updated.title}" reached its signature goal.`,
        { petitionId },
      );
    }
  }

  return {
    ok: true,
    result: {
      id: petitionId,
      justSucceeded,
      signatureCount: updated.signatureCount,
      signed: true,
      status: updated.status,
    },
  };
}

function reportPetitionMemory(
  userId: string,
  petitionId: string,
  submission: ValidReportSubmission,
): ReportPetitionResult {
  if (!getState().petitions.some((petition) => petition.id === petitionId)) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  const alreadyReported = getState().petitionReports.some(
    (report) => report.petitionId === petitionId && report.reporterId === userId,
  );
  if (!alreadyReported) {
    setState((current) => ({
      ...current,
      petitionReports: [
        ...current.petitionReports,
        {
          createdAt: new Date().toISOString(),
          details: submission.details,
          evidenceImageUrl: submission.evidenceImageDataUrl,
          id: `petition-report-${crypto.randomUUID()}`,
          petitionId,
          reason: submission.reason,
          reporterId: userId,
        },
      ],
    }));
  }
  return { ok: true, reported: true };
}

// ---------------------------------------------------------------------------
// Backend dispatch
// ---------------------------------------------------------------------------

export async function getPetitionsGate(ctx: RequestContext): Promise<PetitionsGate> {
  const totalUsers = await countAppUsers(ctx);
  return {
    totalUsers,
    unlocked: totalUsers >= PETITIONS_UNLOCK_MIN_USERS,
    usersNeeded: Math.max(0, PETITIONS_UNLOCK_MIN_USERS - totalUsers),
  };
}

export async function listPetitionsPage(
  ctx: RequestContext,
  options?: ListPetitionsOptions,
): Promise<PetitionsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_PETITIONS_PAGE_SIZE),
    MAX_PETITIONS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  const status = options?.status;
  return ctx.supabase
    ? listPetitionsPageSupabase(ctx.supabase, ctx.userId, status, limit, cursor)
    : listPetitionsPageMemory(ctx.userId, status, limit, cursor);
}

export async function getPetition(
  ctx: RequestContext,
  petitionId: string,
): Promise<Petition | null> {
  return ctx.supabase
    ? getPetitionSupabase(ctx.supabase, ctx.userId, petitionId)
    : getPetitionMemory(petitionId, ctx.userId);
}

export async function getPetitionsByIds(
  ctx: RequestContext,
  ids: readonly string[],
): Promise<readonly Petition[]> {
  if (ids.length === 0) {
    return [];
  }
  return ctx.supabase
    ? getPetitionsByIdsSupabase(ctx.supabase, ctx.userId, ids)
    : getPetitionsByIdsMemory(ctx.userId, ids);
}

export async function getMyPetitionsView(
  ctx: RequestContext,
  options?: MyPetitionsOptions,
): Promise<MyPetitionsPage> {
  const limit = Math.min(
    Math.max(1, options?.limit ?? DEFAULT_MY_PETITIONS_PAGE_SIZE),
    MAX_MY_PETITIONS_PAGE_SIZE,
  );
  const cursor = options?.cursor ?? null;
  return ctx.supabase
    ? getMyPetitionsViewSupabase(ctx.supabase, ctx.userId, limit, cursor)
    : getMyPetitionsViewMemory(ctx.userId, limit, cursor);
}

export async function createPetition(
  ctx: RequestContext,
  input: unknown,
): Promise<CreatePetitionResult> {
  // Re-checked here, server-side, regardless of what the client's own gate
  // state believes -- the client-side gate is UX only, this is the real
  // enforcement boundary.
  const totalUsers = await countAppUsers(ctx);
  if (totalUsers < PETITIONS_UNLOCK_MIN_USERS) {
    return {
      code: 'petitions_locked',
      message: 'Petitions unlock once the community is larger.',
      ok: false,
    };
  }
  return ctx.supabase
    ? createPetitionSupabase(ctx.supabase, ctx.userId, totalUsers, input)
    : createPetitionMemory(ctx.userId, input);
}

// Crossing the threshold marks the petition succeeded and notifies signers
// immediately (see the notify_petition_signers DB trigger / the memory-mode
// equivalent above) -- but does NOT email the HOA board itself. That's a
// deliberate admin-reviewed step (admin/lib/hoa-email.ts), not an automatic
// one: unlike everything else in the app, an email to the actual board can't
// be unsent, so a human looks at the wording once before it goes out.
export async function toggleSignature(
  ctx: RequestContext,
  petitionId: string,
): Promise<ToggleSignatureOutcome> {
  return ctx.supabase
    ? toggleSignatureSupabase(ctx.supabase, ctx.userId, petitionId)
    : toggleSignatureMemory(ctx.userId, petitionId);
}

export async function reportPetition(
  ctx: RequestContext,
  petitionId: string,
  submission: ValidReportSubmission,
): Promise<ReportPetitionResult> {
  return ctx.supabase
    ? reportPetitionSupabase(ctx.supabase, ctx.userId, petitionId, submission)
    : reportPetitionMemory(ctx.userId, petitionId, submission);
}
