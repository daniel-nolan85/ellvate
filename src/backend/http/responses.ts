export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
}

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function jsonError(
  status: number,
  code: string,
  message: string,
): Response {
  const body: ApiErrorBody = { code, message };
  return Response.json(body, { status });
}
