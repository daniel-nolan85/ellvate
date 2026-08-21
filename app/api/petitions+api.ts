import { createPetition, listPetitionsPage } from '@/src/backend/petitions';
import {
  checkWriteRateLimit,
  jsonError,
  jsonOk,
  withRequestContext,
  WRITE_RATE_LIMIT_POLICIES,
} from '@/src/backend/http';
import type { PetitionStatus } from '@/src/backend/store';

const VALID_STATUSES: readonly PetitionStatus[] = ['open', 'succeeded', 'expired'];

function parseStatus(value: string | null): PetitionStatus | undefined {
  return value && (VALID_STATUSES as readonly string[]).includes(value)
    ? (value as PetitionStatus)
    : undefined;
}

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await listPetitionsPage(ctx, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      status: parseStatus(url.searchParams.get('status')),
    });
    return jsonOk(page);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const rateLimit = await checkWriteRateLimit(
      ctx.userId,
      WRITE_RATE_LIMIT_POLICIES.petition,
    );
    if (rateLimit === 'limited') {
      return jsonError(429, 'rate_limited', 'Too many petitions created. Try again shortly.');
    }

    const body: unknown = await request.json().catch(() => null);
    const result = await createPetition(ctx, body);

    if (!result.ok) {
      return jsonError(
        result.code === 'petitions_locked' ? 403 : 400,
        result.code,
        result.message,
      );
    }
    return jsonOk({ petition: result.petition }, { status: 201 });
  });
}
