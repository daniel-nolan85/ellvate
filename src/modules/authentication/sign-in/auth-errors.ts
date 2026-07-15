interface ClerkErrorLike {
  readonly code?: string;
  readonly message?: string;
  readonly longMessage?: string;
  readonly errors?: readonly ClerkErrorLike[];
}

const asError = (error: unknown): ClerkErrorLike =>
  (error as ClerkErrorLike | null | undefined) ?? {};

const errorCode = (error: unknown): string => {
  const candidate = asError(error);
  return candidate.code ?? candidate.errors?.[0]?.code ?? '';
};

export function isMissingIdentifierError(error: unknown): boolean {
  const candidate = asError(error);
  const nested = candidate.errors?.[0];
  const code = errorCode(error).toLowerCase();
  const message = [
    candidate.message,
    candidate.longMessage,
    nested?.message,
    nested?.longMessage,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    code.includes('identifier_not_found') ||
    code.includes('resource_not_found') ||
    message.includes('could not find') ||
    message.includes("couldn't find your account") ||
    message.includes('no account')
  );
}

export function messageForAuthError(
  error: unknown,
  fallback: string,
): string {
  const candidate = asError(error);
  return (
    candidate.longMessage ??
    candidate.message ??
    candidate.errors?.[0]?.longMessage ??
    candidate.errors?.[0]?.message ??
    fallback
  );
}
