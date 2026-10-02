import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

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

// The action that earns a celebration-worthy grant (e.g. creating an event)
// typically also closes a Sheet -- itself a native Modal (see
// src/components/ui/sheet) -- in the very same tick. Sheet's own close
// animation keeps its underlying Modal mounted for CLOSE_DURATION (220ms)
// plus a 150ms backstop before it actually unmounts. Presenting a *second*
// native Modal (this celebration) while that one is still mid-dismiss is a
// known way to hang iOS outright -- not just look wrong -- since UIKit
// doesn't tolerate overlapping present/dismiss transitions. This delay is
// comfortably longer than Sheet's own worst case, so a celebration's Modal
// never opens until any Sheet the triggering action closed has genuinely
// finished closing.
const CELEBRATION_SHOW_DELAY_MS = 450;

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
  // A queue, not a single nullable slot -- a single slot meant a second
  // level-up (e.g. two XP grants resolving close together while rapidly
  // creating content) silently overwrote the first before the user had a
  // chance to see it, with no error and nothing to indicate a celebration
  // they'd genuinely earned was ever shown. Queuing guarantees every
  // level-up/rank-up is eventually shown exactly once, in the order earned.
  const [celebrationQueue, setCelebrationQueue] = useState<readonly Celebration[]>([]);
  // What's actually shown -- deliberately a separate piece of state from
  // the queue itself, not just celebrationQueue[0], so a freshly queued
  // celebration can sit pending for CELEBRATION_SHOW_DELAY_MS before its
  // Modal is allowed to open (see that constant's own WHY).
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
      setCelebrationQueue((queue) => [
        ...queue,
        { leveledUpTo, rankedUpTo, title: outcome.title },
      ]);
    } else {
      setToastAmount(outcome.awardedXp);
    }
  }, []);

  // Advances the queue to its own Modal-visible state, but only after
  // CELEBRATION_SHOW_DELAY_MS has passed with nothing currently showing --
  // see that constant's own WHY for why this can't just show
  // celebrationQueue[0] directly.
  useEffect(() => {
    if (celebration !== null || celebrationQueue.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setCelebration(celebrationQueue[0]);
    }, CELEBRATION_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [celebration, celebrationQueue]);

  const dismissCelebration = useCallback(() => {
    setCelebration(null);
    setCelebrationQueue((queue) => queue.slice(1));
  }, []);

  return (
    <XpFeedbackContext.Provider value={notify}>
      {children}
      <XpToast amount={toastAmount} onHide={() => setToastAmount(null)} />
      <LevelUpCelebrationModal
        newLevel={celebration?.rankedUpTo ? null : (celebration?.leveledUpTo ?? null)}
        onClose={dismissCelebration}
        title={celebration?.title ?? ''}
      />
      <RankUpCelebrationModal
        newTitle={celebration?.rankedUpTo ?? null}
        onClose={dismissCelebration}
      />
    </XpFeedbackContext.Provider>
  );
}
