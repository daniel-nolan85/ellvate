export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

export class ApiError extends Error {
  readonly code: string | null;
  readonly details: unknown;
  readonly status: number;

  constructor({
    code = null,
    details,
    message,
    status,
  }: {
    readonly code?: string | null;
    readonly details?: unknown;
    readonly message: string;
    readonly status: number;
  }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
