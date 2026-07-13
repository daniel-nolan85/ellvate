import { jsonOk } from '@/src/backend/http';

export function GET(): Response {
  return jsonOk({ ok: true });
}
