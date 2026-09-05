// Mirrors src/lib/report-reasons.ts in the Expo app. The admin dashboard is
// a separate Next.js package (its own tsconfig, its own `@/*` root) with no
// access to that app's source tree, so this small label map is duplicated
// here rather than imported.
const REPORT_REASON_LABEL: Readonly<Record<string, string>> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate content',
  scam_or_fraud: 'Scam or fraud',
  impersonation: 'Impersonation',
  other: 'Other',
};

export function reportReasonLabel(reason: string | null): string {
  if (!reason) {
    return 'No reason given';
  }
  return REPORT_REASON_LABEL[reason] ?? reason;
}
