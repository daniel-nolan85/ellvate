export interface Notification {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationsPage {
  readonly notifications: readonly Notification[];
  // Opaque cursor for the next page, or null when there's nothing further —
  // pass back as-is via the `cursor` query param.
  readonly nextCursor: string | null;
}

export interface ListNotificationsOptions {
  readonly limit?: number;
  readonly cursor?: string | null;
}
