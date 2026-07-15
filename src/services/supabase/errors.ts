export class SupabaseRequestError extends Error {
  constructor(operation: string, message = 'database request failed') {
    super(`${operation}: ${message}`);
    this.name = 'SupabaseRequestError';
  }
}

export function throwIfSupabaseError(
  error: { readonly message?: string } | null | undefined,
  operation: string,
): void {
  if (error) {
    throw new SupabaseRequestError(operation, error.message);
  }
}
