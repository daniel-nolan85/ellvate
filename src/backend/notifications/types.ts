export interface Notification {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly readAt: string | null;
  readonly createdAt: string;
}
