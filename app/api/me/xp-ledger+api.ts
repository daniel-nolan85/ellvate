import { jsonOk, withRequestContext } from '@/src/backend/http';
import { getXpLedger, type XpReason } from '@/src/backend/xp';

const XP_REASONS: ReadonlySet<XpReason> = new Set([
  'mission_completed',
  'mission_created',
  'post_created',
  'event_created',
  'service_created',
  'onboarding_bonus',
]);

const parseReasons = (value: string | null): readonly XpReason[] | undefined => {
  if (!value) {
    return undefined;
  }
  const reasons = value
    .split(',')
    .map((reason) => reason.trim())
    .filter((reason): reason is XpReason => XP_REASONS.has(reason as XpReason));
  return reasons.length > 0 ? reasons : undefined;
};

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const page = await getXpLedger(ctx, {
      cursor: url.searchParams.get('cursor'),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      reasons: parseReasons(url.searchParams.get('reasons')),
    });
    return jsonOk(page);
  });
}
