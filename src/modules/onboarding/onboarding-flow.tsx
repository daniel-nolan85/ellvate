import React, { useCallback, useEffect, useState, type ReactNode } from 'react';

import { View } from 'react-native';

import { Spinner } from '@/src/components/ui/spinner';
import { useWelcomeBackNotice } from '@/src/platform/notices';
import { useSession } from '@/src/platform/session';

import { AuthStep } from './auth-step';
import { ObHeader } from './chrome';
import { CommitStep } from './commit-step';
import { MomentStep, MOMENTS } from './feature-step';
import { InterestsStep } from './interests-step';
import { NameStep } from './name-step';
import { NotificationsStep } from './notifications-step';
import { PasskeyStep } from './passkey-step';
import { RoleStep } from './role-step';
import {
  fetchReturningProfile,
  markOnboardingComplete,
  useOnboardingState,
  type ReturningProfile,
} from './use-onboarding-state';
import { WelcomeStep } from './welcome-step';

// The auth step lives at a fixed slot right after the welcome screen. Once a
// session is active it is skipped by navigation (not by the step itself), so
// back and next never bounce off a self-advancing screen.
const AUTH_INDEX = 1;

// role is the first step that renders ObHeader; notifications is the last.
const CHROME_FIRST_INDEX = 2;
const CHROME_STEP_COUNT = 12;

interface OnboardingFlowProps {
  readonly onFinished: () => void;
}

export function OnboardingFlow({ onFinished }: OnboardingFlowProps) {
  const session = useSession();
  const { show: showWelcomeBack } = useWelcomeBackNotice();
  const [step, setStep] = useState(0);
  const [checkingReturningUser, setCheckingReturningUser] = useState(false);
  const {
    completeOnboarding,
    completionError,
    draft,
    setName,
    setRole,
    toggleInterest,
    toggleNotification,
  } = useOnboardingState();

  // The Face ID offer needs a real Clerk user AND native passkey support
  // (Associated Domains + a Clerk instance that serves a matching AASA). Until
  // that infrastructure is in place, EXPO_PUBLIC_ENABLE_PASSKEYS gates the step
  // off so onboarding never dead-ends on a passkey prompt that cannot succeed.
  const clerkUsable =
    session.status !== 'disabled' && session.status !== 'misconfigured';
  const isSignedIn = session.status === 'signed-in';
  const includePasskey =
    clerkUsable && process.env.EXPO_PUBLIC_ENABLE_PASSKEYS === 'true';
  // welcome, auth, role, name, interests, 8 feature moments, notifications,
  // [passkey], commit.
  const stepCount = includePasskey ? 16 : 15;

  const goNext = useCallback(() => {
    if (checkingReturningUser) {
      return;
    }
    setStep((current) => {
      if (current === AUTH_INDEX && clerkUsable && !isSignedIn) {
        // The code step just verified, but isSignedIn is derived from Clerk
        // state that hasn't reached this render yet -- stay put. The effect
        // below picks this up as soon as it has (and decides whether this is
        // a returning, already-onboarded user) instead of this advancing
        // straight to the role step first regardless.
        return current;
      }
      let next = Math.min(stepCount - 1, current + 1);
      if (next === AUTH_INDEX && isSignedIn) {
        next = Math.min(stepCount - 1, next + 1);
      }
      return next;
    });
  }, [checkingReturningUser, clerkUsable, isSignedIn, stepCount]);

  const goBack = useCallback(() => {
    setStep((current) => {
      let prev = Math.max(0, current - 1);
      if (prev === AUTH_INDEX && isSignedIn) {
        prev = Math.max(0, prev - 1);
      }
      return prev;
    });
  }, [isSignedIn]);

  // A signed-in session at or before the auth slot means either this device
  // already had a valid Clerk session when onboarding started (e.g. an iOS
  // reinstall, where Clerk's session commonly survives in the Keychain even
  // though this app's own on-device onboarding flag didn't), or the code
  // step just finished. Either way, check the real profile before showing
  // role/name/interests again instead of assuming this is a brand-new user.
  useEffect(() => {
    if (!isSignedIn || step > AUTH_INDEX) {
      return;
    }
    let cancelled = false;
    setCheckingReturningUser(true);
    void (async () => {
      let returning: ReturningProfile | null = null;
      try {
        returning = await fetchReturningProfile(session.getToken);
      } catch {
        returning = null;
      }
      if (cancelled) {
        return;
      }
      if (returning?.onboardedAt) {
        await markOnboardingComplete();
        // Show the greeting (it renders from the root layout, not here --
        // see WelcomeBackNoticeProvider) and navigate immediately, rather
        // than waiting for it to be dismissed first. Waiting meant the
        // destination screen didn't even start loading until after the
        // modal closed, so dismissing it always led into a second loading
        // spinner instead of straight into the now-ready app. An empty
        // string renders a name-less "Welcome back!" instead of blank.
        showWelcomeBack(returning.name.trim());
        onFinished();
        return;
      }
      setCheckingReturningUser(false);
      setStep((current) => (current <= AUTH_INDEX ? AUTH_INDEX + 1 : current));
    })();
    return () => {
      cancelled = true;
    };
    // welcomeBack.show is a stable reference (see WelcomeBackNoticeProvider);
    // depending on the whole welcomeBack object instead would re-run this
    // effect the moment show() updates its name, right as this component is
    // about to unmount from the onFinished() navigation.
  }, [isSignedIn, onFinished, session.getToken, showWelcomeBack, step]);

  const handleDone = useCallback(async () => {
    const completed = await completeOnboarding();
    if (completed) {
      onFinished();
    }
  }, [completeOnboarding, onFinished]);

  // Progress dots should only count the steps that actually render this
  // shared header (role, name, interests, the 8 moments, notifications) --
  // welcome, auth, passkey, and commit each render their own full-screen UI
  // with no header, so counting them would make the dots jump straight to
  // "3rd of 13" the very first time a user sees them.
  const chrome = (skippable: boolean): ReactNode => (
    <ObHeader
      onBack={goBack}
      onSkip={goNext}
      skippable={skippable}
      step={step - CHROME_FIRST_INDEX}
      total={CHROME_STEP_COUNT}
    />
  );

  const steps: readonly ReactNode[] = [
    <WelcomeStep key="welcome" onNext={goNext} />,
    <AuthStep key="auth" onBack={goBack} onNext={goNext} />,
    <RoleStep
      // Not skippable -- see the WHY on the InterestsStep entry below, the
      // same reasoning applies here: role is one of the two fields (with
      // interests) the backend requires before it will ever set
      // onboardedAt (see ONBOARDING_MIN_INTERESTS's usage in
      // src/backend/profile/profile.ts's isOnboardingComplete).
      chrome={chrome(false)}
      key="role"
      onNext={goNext}
      onPick={setRole}
      value={draft.role}
    />,
    <NameStep
      chrome={chrome(true)}
      key="name"
      onChange={setName}
      onNext={goNext}
      value={draft.name}
    />,
    <InterestsStep
      // Not skippable -- this step's own CTA already disables "Continue"
      // below MIN_PICKS, but the header's Skip link used to call goNext()
      // directly, bypassing that entirely and leaving draft.interests
      // short (or role null, from the step above). completeOnboarding()
      // still PUTs successfully and unconditionally marks the *local*
      // AsyncStorage flag complete either way, but the backend's own
      // isOnboardingComplete requires role !== null AND interests.length
      // >= ONBOARDING_MIN_INTERESTS before it will ever set onboardedAt --
      // so a skip here left onboardedAt permanently null server-side while
      // the device-local flag read complete, which is exactly what
      // app/index.tsx's own isComplete check (server truth for a real
      // signed-in session, never the local flag) then read as "not
      // onboarded" on every subsequent launch. Confirmed via the onboarding
      // debug overlay: local=true, server onboardedAt=n/a.
      chrome={chrome(false)}
      key="interests"
      onNext={goNext}
      onToggle={toggleInterest}
      picks={draft.interests}
    />,
    <MomentStep chrome={chrome(false)} key="moment-forum" moment={MOMENTS[0]} onNext={goNext} />,
    <MomentStep chrome={chrome(false)} key="moment-events" moment={MOMENTS[1]} onNext={goNext} />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-missions"
      moment={MOMENTS[2]}
      onNext={goNext}
    />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-services"
      moment={MOMENTS[3]}
      onNext={goNext}
    />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-leaderboard"
      moment={MOMENTS[4]}
      onNext={goNext}
    />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-petitions"
      moment={MOMENTS[5]}
      onNext={goNext}
    />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-digest"
      moment={MOMENTS[6]}
      onNext={goNext}
    />,
    <MomentStep
      chrome={chrome(false)}
      key="moment-assistant"
      moment={MOMENTS[7]}
      onNext={goNext}
    />,
    <NotificationsStep
      chrome={chrome(false)}
      key="notifications"
      onNext={goNext}
      onToggle={toggleNotification}
      prefs={draft.notificationPrefs}
    />,
    ...(includePasskey ? [<PasskeyStep key="passkey" onNext={goNext} />] : []),
    <CommitStep
      error={completionError}
      key="commit"
      onDone={() => void handleDone()}
      onRetry={() => void handleDone()}
    />,
  ];

  if (checkingReturningUser) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <Spinner size="xlarge" />
      </View>
    );
  }

  return <View className="flex-1 bg-canvas">{steps[step]}</View>;
}
