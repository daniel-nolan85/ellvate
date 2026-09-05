// Shared between every report submission form (post, comment, event,
// mission, service, petition, review, check-in, member) and every report
// backend function's own validation — one fixed list, matching the CHECK
// constraint on each report table's `reason` column (see migration
// 0053_report_reasons_and_evidence.sql). Keeping this list here, not
// duplicated per report type, is what lets a single shared report form
// component work for all of them.

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'inappropriate_content',
  'scam_or_fraud',
  'impersonation',
  'other',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Readonly<Record<ReportReason, string>> = {
  harassment: 'Harassment or bullying',
  impersonation: 'Impersonation',
  inappropriate_content: 'Inappropriate content',
  other: 'Other',
  scam_or_fraud: 'Scam or fraud',
  spam: 'Spam',
};

export const isReportReason = (value: unknown): value is ReportReason =>
  typeof value === 'string' && (REPORT_REASONS as readonly string[]).includes(value);
