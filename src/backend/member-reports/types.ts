export type ReportMemberResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'member_not_found' | 'cannot_report_self';
      readonly message: string;
    };
