import type { SupabaseClient } from '@supabase/supabase-js';

import { validateCommentBody } from '@/src/backend/comments';
import { getMutedUserIdsSupabase } from '@/src/backend/mutes/mutes-supabase';
import { defaultDisplayName } from '@/src/backend/store';
import { paginateInMemory } from '@/src/lib/cursor-pagination';
import { throwIfSupabaseError } from '@/src/services/supabase';

import { uploadReportEvidence, type ValidReportSubmission } from '../reports/report-submission';
import type {
  CreateMissionCommentResult,
  MissionComment,
  MissionCommentsPage,
  ReportMissionCommentResult,
  UpdateMissionCommentResult,
} from './types';

const MISSION_COMMENT_SELECT =
  'id,mission_id,author_id,body,created_at,edited_at,author:app_users!mission_comments_author_id_fkey(id,name,avatar_url,is_admin)';

interface MissionCommentRow {
  readonly id: string;
  readonly mission_id: string;
  readonly author_id: string;
  readonly body: string;
  readonly created_at: string;
  readonly edited_at: string | null;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly avatar_url: string | null;
    readonly is_admin: boolean;
  } | null;
}

const toMissionComment = (row: MissionCommentRow): MissionComment => ({
  author: {
    avatarUrl: row.author?.avatar_url ?? null,
    id: row.author_id,
    isAdmin: row.author?.is_admin ?? false,
    name: row.author?.name ?? 'Member',
  },
  body: row.body,
  createdAt: row.created_at,
  editedAt: row.edited_at,
  id: row.id,
  missionId: row.mission_id,
});

const ensureUser = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('app_users')
    .upsert(
      { id: userId, name: defaultDisplayName(userId) },
      { ignoreDuplicates: true, onConflict: 'id' },
    );
  throwIfSupabaseError(error, 'ensure mission comment user');
};

export async function listMissionCommentsSupabase(
  supabase: SupabaseClient,
  missionId: string,
): Promise<readonly MissionComment[]> {
  const { data, error } = await supabase
    .from('mission_comments')
    .select(MISSION_COMMENT_SELECT)
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'load mission comments');
  return (data as unknown as MissionCommentRow[]).map(toMissionComment);
}

// The paginated counterpart to listMissionCommentsSupabase, mirroring the
// fetch-then-paginate-in-application-code precedent used across this
// codebase's Supabase backends. Oldest-first, matching the thread's natural
// reading order -- the sortKey inverts the timestamp since paginateInMemory
// always sorts descending (same trick used for forum/event comments).
const MAX_MISSION_COMMENT_TIMESTAMP = 9_999_999_999_999;

export async function listMissionCommentsPageSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  limit: number,
  cursor: string | null,
): Promise<MissionCommentsPage> {
  const [{ data, error }, mutedUserIds] = await Promise.all([
    supabase
      .from('mission_comments')
      .select(MISSION_COMMENT_SELECT)
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true }),
    getMutedUserIdsSupabase(supabase, userId),
  ]);
  throwIfSupabaseError(error, 'load mission comments');
  const mutedSet = new Set(mutedUserIds);
  const rows = ((data as unknown as MissionCommentRow[]) ?? []).filter(
    (row) => !mutedSet.has(row.author_id),
  );

  const wrapped = rows.map((row) => ({
    id: row.id,
    row,
    sortKey: String(
      MAX_MISSION_COMMENT_TIMESTAMP - Date.parse(row.created_at),
    ).padStart(13, '0'),
  }));
  const page = paginateInMemory(wrapped, limit, cursor);

  return {
    comments: page.items.map((item) => toMissionComment(item.row)),
    nextCursor: page.nextCursor,
  };
}

export async function createMissionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  missionId: string,
  input: unknown,
): Promise<CreateMissionCommentResult> {
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data: mission, error: missionError } = await supabase
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .maybeSingle();
  throwIfSupabaseError(missionError, 'load comment mission');
  if (!mission) {
    return { code: 'mission_not_found', message: 'Mission not found.', ok: false };
  }
  await ensureUser(supabase, userId);
  const { data, error } = await supabase
    .from('mission_comments')
    .insert({ author_id: userId, body: validation.body, mission_id: missionId })
    .select(MISSION_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'create mission comment');
  if (!data) {
    throw new Error('create mission comment: database returned no comment.');
  }
  return {
    comment: toMissionComment(data as unknown as MissionCommentRow),
    ok: true,
  };
}

export async function updateMissionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  input: unknown,
): Promise<UpdateMissionCommentResult> {
  const { data: existing, error: existingError } = await supabase
    .from('mission_comments')
    .select('id,author_id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(existingError, 'load mission comment for update');
  if (!existing) {
    return {
      code: 'mission_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }
  if (existing.author_id !== userId) {
    return {
      code: 'forbidden',
      message: 'You can only edit your own comments.',
      ok: false,
    };
  }
  const validation = validateCommentBody(input);
  if (!validation.ok) {
    return { code: 'invalid_comment', message: validation.message, ok: false };
  }
  const { data, error } = await supabase
    .from('mission_comments')
    .update({ body: validation.body, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .select(MISSION_COMMENT_SELECT)
    .single();
  throwIfSupabaseError(error, 'update mission comment');
  if (!data) {
    throw new Error('update mission comment: database returned no comment.');
  }
  return {
    comment: toMissionComment(data as unknown as MissionCommentRow),
    ok: true,
  };
}

export async function deleteMissionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('mission_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id');
  throwIfSupabaseError(error, 'delete mission comment');
  return Array.isArray(data) && data.length > 0;
}

export async function reportMissionCommentSupabase(
  supabase: SupabaseClient,
  userId: string,
  commentId: string,
  submission: ValidReportSubmission,
): Promise<ReportMissionCommentResult> {
  const { data: comment, error: commentError } = await supabase
    .from('mission_comments')
    .select('id')
    .eq('id', commentId)
    .maybeSingle();
  throwIfSupabaseError(commentError, 'load reported mission comment');
  if (!comment) {
    return {
      code: 'mission_comment_not_found',
      message: 'Comment not found.',
      ok: false,
    };
  }

  await ensureUser(supabase, userId);
  const evidenceImageUrl = await uploadReportEvidence(
    supabase,
    userId,
    submission.evidenceImageDataUrl,
  );
  // Idempotent: a unique (mission_comment_id, reporter_id) constraint on
  // mission_comment_reports means a repeat report from the same user is a
  // silent no-op, not an error.
  const { error } = await supabase
    .from('mission_comment_reports')
    .upsert(
      {
        details: submission.details,
        evidence_image_url: evidenceImageUrl,
        mission_comment_id: commentId,
        reason: submission.reason,
        reporter_id: userId,
      },
      { ignoreDuplicates: true, onConflict: 'mission_comment_id,reporter_id' },
    );
  throwIfSupabaseError(error, 'report mission comment');
  return { ok: true, reported: true };
}
