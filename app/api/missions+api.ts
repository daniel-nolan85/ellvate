import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import { createMission, listMissionsPage, type MissionFilter } from '@/src/backend/missions';

const MISSION_FILTERS: ReadonlySet<MissionFilter> = new Set([
  'available',
  'in-progress',
  'completed',
]);

const parseFilter = (value: string | null): MissionFilter =>
  MISSION_FILTERS.has(value as MissionFilter) ? (value as MissionFilter) : 'available';

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listMissionsPage(ctx, {
      cursor: url.searchParams.get('cursor'),
      filter: parseFilter(url.searchParams.get('filter')),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    return jsonOk(page);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.post,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many missions created. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createMission(ctx, body);

    if (!result.ok) {
      return jsonError(400, result.code, result.message);
    }
    return jsonOk({ mission: result.mission }, { status: 201 });
  });
}
