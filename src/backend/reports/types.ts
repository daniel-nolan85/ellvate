export type ReportPostResult =
  | { readonly ok: true; readonly reported: true }
  | {
      readonly ok: false;
      readonly code: 'post_not_found';
      readonly message: string;
    };
