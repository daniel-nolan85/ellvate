import type { SupabaseClient } from '@supabase/supabase-js';

import { uploadDataUrl } from '@/src/services/storage';
import { REPORT_REASONS, isReportReason, type ReportReason } from '@/src/lib/report-reasons';

// Shared by every one of the 11 report backend functions (post, comment,
// event, mission, service, petition, review, check-in, member) so reason
// validation and evidence handling stay in one place rather than being
// re-implemented per report type.

const MAX_DETAILS_LENGTH = 1000;

// A plain untyped JSON body, e.g. from `request.json()` -- not a named
// interface, so every API route's `body ?? {}` (typed `Record<string,
// unknown> | {}`) is assignable without a cast.
export type ReportSubmissionInput = Record<string, unknown>;

export interface ValidReportSubmission {
  readonly reason: ReportReason;
  readonly details: string | null;
  readonly evidenceImageDataUrl: string | null;
}

export type ReportSubmissionError = {
  readonly ok: false;
  readonly code: 'invalid_reason';
  readonly message: string;
};

export function parseReportSubmission(
  input: ReportSubmissionInput,
): { readonly ok: true; readonly submission: ValidReportSubmission } | ReportSubmissionError {
  if (!isReportReason(input.reason)) {
    return {
      code: 'invalid_reason',
      message: `reason must be one of: ${REPORT_REASONS.join(', ')}`,
      ok: false,
    };
  }
  const details =
    typeof input.details === 'string' && input.details.trim().length > 0
      ? input.details.trim().slice(0, MAX_DETAILS_LENGTH)
      : null;
  const evidenceImageDataUrl =
    typeof input.evidenceImageDataUrl === 'string' ? input.evidenceImageDataUrl : null;
  return {
    ok: true,
    submission: { details, evidenceImageDataUrl, reason: input.reason },
  };
}

// Uploads under the reporter's own id, not any content id -- a report can
// target a user directly, with no content row to key the folder off (see
// migration 0053's 'report-evidence' owns_media_object() case). Best-effort:
// a failed upload doesn't block the report itself from being filed, it's
// just recorded without evidence rather than losing the whole report.
export async function uploadReportEvidence(
  supabase: SupabaseClient,
  reporterId: string,
  evidenceImageDataUrl: string | null,
): Promise<string | null> {
  if (!evidenceImageDataUrl) {
    return null;
  }
  return uploadDataUrl(
    supabase,
    evidenceImageDataUrl,
    'evidence.jpg',
    'report-evidence',
    reporterId,
  );
}
