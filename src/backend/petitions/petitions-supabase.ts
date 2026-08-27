import type { SupabaseClient } from '@supabase/supabase-js';

import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import type { PetitionCategory, PetitionStatus } from '@/src/backend/store';
import { decodeCursor, encodeCursor } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { computeRequiredSignatures } from './types';
import type {
  CreatePetitionResult,
  PersonRef,
  Petition,
  PetitionsPage,
  ReportPetitionResult,
  ToggleSignatureOutcome,
} from './types';
import { validatePetitionInput } from './validation';

const PETITION_SELECT =
  'id,created_by,title,description,category,deadline_days,deadline_at,required_signatures,signature_count,status,succeeded_at,hoa_response,hoa_response_at,created_at,creator:app_users!petitions_created_by_fkey(id,name,avatar_url,is_admin)';

interface PetitionRow {
  readonly id: string;
  readonly created_by: string | null;
  readonly title: string;
  readonly description: string;
  readonly category: PetitionCategory;
  readonly deadline_days: 7 | 14 | 30 | 60 | 90;
  readonly deadline_at: string;
  readonly required_signatures: number;
  readonly signature_count: number;
  readonly status: PetitionStatus;
  readonly succeeded_at: string | null;
  readonly hoa_response: string | null;
  readonly hoa_response_at: string | null;
  readonly created_at: string;
  readonly creator: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

const toCreatorRef = (row: PetitionRow): PersonRef => ({
  avatarUrl: row.creator?.avatar_url ?? null,
  id: row.created_by ?? 'unknown',
  isAdmin: row.creator?.is_admin ?? false,
  name: row.creator?.name ?? 'Former member',
});

const toPetition = (row: PetitionRow, signed: boolean): Petition => ({
  category: row.category,
  createdAt: row.created_at,
  createdBy: toCreatorRef(row),
  deadlineAt: row.deadline_at,
  deadlineDays: row.deadline_days,
  description: row.description,
  hoaResponse: row.hoa_response,
  hoaResponseAt: row.hoa_response_at,
  id: row.id,
  requiredSignatures: row.required_signatures,
  signatureCount: row.signature_count,
  signed,
  status: row.status,
  succeededAt: row.succeeded_at,
  title: row.title,
});

const ensureUser = async (supabase: SupabaseClient, userId: string): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert({ id: userId, name: 'Member' }, { ignoreDuplicates: true, onConflict: 'id' });
  throwIfSupabaseError(error, 'ensure petition user');
};

export async function listPetitionsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  status: PetitionStatus | undefined,
  limit: number,
  cursor: string | null,
): Promise<PetitionsPage> {
  const mutedUserIds = await getMutedUserIdsSupabase(supabase, userId);

  let query = supabase
    .from('petitions')
    .select(PETITION_SELECT)
    .eq('status', status ?? 'open')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (mutedUserIds.length > 0) {
    query = query.not('created_by', 'in', `(${mutedUserIds.join(',')})`);
  }

  const parsedCursor = cursor ? decodeCursor(cursor) : null;
  if (parsedCursor) {
    query = query.or(
      `created_at.lt.${parsedCursor.sortKey},and(created_at.eq.${parsedCursor.sortKey},id.lt.${parsedCursor.id})`,
    );
  }

  const { data, error } = await query;
  throwIfSupabaseError(error, 'load petitions');
  const rows = (data ?? []) as unknown as PetitionRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const { data: signedRows, error: signedError } = page.length
    ? await supabase
        .from('petition_signatures')
        .select('petition_id')
        .eq('user_id', userId)
        .in('petition_id', page.map((row) => row.id))
    : { data: [] as { petition_id: string }[], error: null };
  throwIfSupabaseError(signedError, 'load own petition signatures');
  const signedIds = new Set((signedRows ?? []).map((row) => row.petition_id));

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ id: last.id, sortKey: last.created_at }) : null;

  return {
    nextCursor,
    petitions: page.map((row) => toPetition(row, signedIds.has(row.id))),
  };
}

export async function getPetitionSupabase(
  supabase: SupabaseClient,
  userId: string,
  petitionId: string,
): Promise<Petition | null> {
  const { data, error } = await supabase
    .from('petitions')
    .select(PETITION_SELECT)
    .eq('id', petitionId)
    .maybeSingle();
  throwIfSupabaseError(error, 'load petition');
  if (!data) {
    return null;
  }
  const { data: signature, error: signatureError } = await supabase
    .from('petition_signatures')
    .select('petition_id')
    .eq('petition_id', petitionId)
    .eq('user_id', userId)
    .maybeSingle();
  throwIfSupabaseError(signatureError, 'load own petition signature');
  return toPetition(data as unknown as PetitionRow, signature !== null);
}

export async function createPetitionSupabase(
  supabase: SupabaseClient,
  userId: string,
  totalUsers: number,
  input: unknown,
): Promise<CreatePetitionResult> {
  const validation = validatePetitionInput(input);
  if (!validation.ok) {
    return validation;
  }
  const value = validation.value;
  await ensureUser(supabase, userId);
  const deadlineAt = new Date(
    Date.now() + value.deadlineDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase
    .from('petitions')
    .insert({
      category: value.category,
      created_by: userId,
      deadline_at: deadlineAt,
      deadline_days: value.deadlineDays,
      description: value.description,
      required_signatures: computeRequiredSignatures(totalUsers),
      title: value.title,
    })
    .select(PETITION_SELECT)
    .single();
  throwIfSupabaseError(error, 'create petition');
  if (!data) {
    throw new Error('create petition: database returned no petition.');
  }
  return { ok: true, petition: toPetition(data as unknown as PetitionRow, false) };
}

export async function toggleSignatureSupabase(
  supabase: SupabaseClient,
  userId: string,
  petitionId: string,
): Promise<ToggleSignatureOutcome> {
  await ensureUser(supabase, userId);
  const { data, error } = await supabase.rpc('toggle_petition_signature', {
    p_petition_id: petitionId,
  });
  if (error?.message === 'petition_not_found') {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  if (error?.message === 'petition_not_open') {
    return {
      code: 'petition_not_open',
      message: 'This petition is no longer open for signatures.',
      ok: false,
    };
  }
  throwIfSupabaseError(error, 'toggle petition signature');
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        signed: boolean;
        signature_count: number;
        status: PetitionStatus;
        just_succeeded: boolean;
      }
    | undefined;
  if (!row) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  return {
    ok: true,
    result: {
      id: petitionId,
      justSucceeded: row.just_succeeded,
      signatureCount: row.signature_count,
      signed: row.signed,
      status: row.status,
    },
  };
}

export async function reportPetitionSupabase(
  supabase: SupabaseClient,
  userId: string,
  petitionId: string,
): Promise<ReportPetitionResult> {
  const { data: petition, error: petitionError } = await supabase
    .from('petitions')
    .select('id')
    .eq('id', petitionId)
    .maybeSingle();
  throwIfSupabaseError(petitionError, 'load reported petition');
  if (!petition) {
    return { code: 'petition_not_found', message: 'Petition not found.', ok: false };
  }
  await ensureUser(supabase, userId);
  // Idempotent: a unique (petition_id, reporter_id) constraint means a
  // repeat report from the same user is a silent no-op, not an error.
  const { error } = await supabase
    .from('petition_reports')
    .upsert(
      { petition_id: petitionId, reporter_id: userId },
      { ignoreDuplicates: true, onConflict: 'petition_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report petition');
  return { ok: true, reported: true };
}
