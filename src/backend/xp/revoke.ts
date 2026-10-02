import type { RequestContext } from '@/src/backend/http';
import { setState } from '@/src/backend/store';
import type { XpReason } from '@/src/backend/store';

export interface RevokeXpInput {
  readonly reason: XpReason;
  readonly refId: string;
}

// A given (reason, refId) pair can legitimately match more than one ledger
// row -- e.g. several different members each completing the same mission,
// each with their own 'mission_completed' row sharing that mission's id as
// refId. Revoking has to walk all of them and credit each affected user's
// own decrement, not assume a single match the way a one-off lookup would.
//
// A 'mission_completed' match also means that user's missions_completed
// counter (the one the Leaderboard reads) needs decrementing alongside
// their xp -- mirrors supabase/migrations/0075's equivalent fix to
// revoke_content_xp() for Supabase mode.
function revokeXpMemory(reason: XpReason, refId: string): void {
  setState((state) => {
    const matches = state.xpLedger.filter(
      (entry) => entry.reason === reason && entry.refId === refId,
    );
    if (matches.length === 0) {
      return state;
    }
    const matchedIds = new Set(matches.map((entry) => entry.id));
    const xpDeltaByUser = new Map<string, number>();
    const missionsDeltaByUser = new Map<string, number>();
    for (const entry of matches) {
      xpDeltaByUser.set(entry.userId, (xpDeltaByUser.get(entry.userId) ?? 0) + entry.amount);
      if (entry.reason === 'mission_completed') {
        missionsDeltaByUser.set(entry.userId, (missionsDeltaByUser.get(entry.userId) ?? 0) + 1);
      }
    }
    return {
      ...state,
      users: state.users.map((user) => {
        const xpDelta = xpDeltaByUser.get(user.id);
        const missionsDelta = missionsDeltaByUser.get(user.id);
        if (!xpDelta && !missionsDelta) {
          return user;
        }
        return {
          ...user,
          missionsCompleted: missionsDelta
            ? Math.max(0, user.missionsCompleted - missionsDelta)
            : user.missionsCompleted,
          xp: xpDelta ? Math.max(0, user.xp - xpDelta) : user.xp,
        };
      }),
      xpLedger: state.xpLedger.filter((entry) => !matchedIds.has(entry.id)),
    };
  });
}

// Reverses the XP a piece of content earned when it was created (or, for
// missions, also when it was completed), called right after that content
// is actually deleted. Memory mode does the work directly here. Supabase
// mode is a deliberate no-op -- the matching AFTER DELETE trigger on the
// content's own table (see supabase/migrations/0074_revoke_xp_on_delete.sql)
// does the equivalent revoke atomically with the delete itself, and does it
// for every deletion path, not just this app's own backend -- including the
// admin dashboard's generic deleteContentAction, which deletes rows
// directly and never runs this function at all. Keeping the call site here
// symmetric across both backends (rather than only calling it for memory
// mode) means a content type's delete dispatcher never has to know which
// backend it's running against to decide whether revocation is its job.
export function revokeXp(ctx: RequestContext, input: RevokeXpInput): void {
  if (ctx.supabase) {
    return;
  }
  revokeXpMemory(input.reason, input.refId);
}
