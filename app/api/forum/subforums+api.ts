import { listSubforums } from '@/src/backend/forum';
import { jsonOk } from '@/src/backend/http';

export function GET(): Response {
  return jsonOk({ subforums: listSubforums() });
}
