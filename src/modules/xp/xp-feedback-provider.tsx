import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { computeLeveledUpTo, computeRankedUpTo } from './level-up';
import { LevelUpCelebrationModal } from './level-up-celebration-modal';
import { RankUpCelebrationModal } from './rank-up-celebration-modal';
import type { XpAwardOutcome } from './types';
import { XpToast } from './xp-toast';

interface Celebration {
  readonly leveledUpTo: number | null;
  readonly rankedUpTo: string | null;
  readonly title: string;
}

type NotifyXpAwarded = (outcome: XpAwardOutcome) => void;

const XpFeedbackContext = createContext<NotifyXpAwarded | null>(null);

// Every XP-earning mutation across the app (creating a post/event/mission/
// service, completing a mission) calls this instead of managing its own
// local toast/celebration state -- see XpFeedbackProvider's own WHY for why
// that used to lose the celebration whenever the triggering screen was
// navigated away from before the response landed.
export function useNotifyXpAwarded(): NotifyXpAwarded {
  const notify = useContext(XpFeedbackContext);
  if (!notify) {
    throw new Error('useNotifyXpAwarded must be used within an XpFeedbackProvider');
  }
  return notify;
}

// Mounted once, at the app root (see app/_layout.tsx) -- above the
// navigation stack, not inside any one screen. Every XP celebration used to
// live in local screen state (e.g. mission-detail-screen.tsx's own
// useState, before this module existed), which meant navigating away
// before the mutation's response landed silently dropped a celebration the
// user had actually earned. A provider mounted here outlives every screen,
// so the outcome is never lost to navigation timing again.
export function XpFeedbackProvider({ children }: { readonly children: ReactNode }) {
  const [toastAmount, setToastAmount] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const notify = useCallback<NotifyXpAwarded>((outcome) => {
    if (outcome.awardedXp <= 0) {
      return;
    }
    const leveledUpTo = computeLeveledUpTo(outcome.previousLevel, outcome.newLevel);
    const rankedUpTo = computeRankedUpTo(outcome.previousLevel, outcome.newLevel);
    if (leveledUpTo !== null) {
      // A level-up (and, rarer still, a rank-up) is a bigger moment than
      // the routine toast -- see LevelUpCelebrationModal/
      // RankUpCelebrationModal's own WHY -- so it preempts the toast
      // entirely rather than showing both.
      setCelebration({ leveledUpTo, rankedUpTo, title: outcome.title });
    } else {
      setToastAmount(outcome.awardedXp);
    }
  }, []);

  return (
    <XpFeedbackContext.Provider value={notify}>
      {children}
      <XpToast amount={toastAmount} onHide={() => setToastAmount(null)} />
      <LevelUpCelebrationModal
        newLevel={celebration?.rankedUpTo ? null : (celebration?.leveledUpTo ?? null)}
        onClose={() => setCelebration(null)}
        title={celebration?.title ?? ''}
      />
      <RankUpCelebrationModal
        newTitle={celebration?.rankedUpTo ?? null}
        onClose={() => setCelebration(null)}
      />
    </XpFeedbackContext.Provider>
  );
}
