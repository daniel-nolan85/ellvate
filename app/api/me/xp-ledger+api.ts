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

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

// A single "YYYY-MM" param (rather than accepting arbitrary from/to
// timestamps straight from the client) both matches exactly what the
// History tab's month filter needs and keeps the accepted input narrow and
// easy to validate. Malformed values are silently ignored -- same
// treatment as an unrecognized `reasons` entry above -- so a bad param
// falls back to "no date filter" instead of erroring the whole request.
const parseMonthRange = (
  value: string | null,
): { readonly from: string; readonly to: string } | undefined => {
  const match = value ? MONTH_PATTERN.exec(value) : null;
  if (!match) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return undefined;
  }
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: from.toISOString(), to: to.toISOString() };
};

export async function GET(request: Request): Promise<Response> {
  return withRequestContext(request, async (ctx) => {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const monthRange = parseMonthRange(url.searchParams.get('month'));
    const page = await getXpLedger(ctx, {
      cursor: url.searchParams.get('cursor'),
      from: monthRange?.from,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      reasons: parseReasons(url.searchParams.get('reasons')),
      to: monthRange?.to,
    });
    return jsonOk(page);
  });
}
