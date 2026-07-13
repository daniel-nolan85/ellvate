import React, { useCallback, useState, type ReactNode } from 'react';

import { View } from 'react-native';

import { useSession } from '@/src/platform/session';

import { AiStep } from './ai-step';
import { AuthStep } from './auth-step';
import { ObHeader } from './chrome';
import { CommitStep } from './commit-step';
import { FeatureStep } from './feature-step';
import { InterestsStep } from './interests-step';
import { NotificationsStep } from './notifications-step';
import { PasskeyStep } from './passkey-step';
import { RoleStep } from './role-step';
import { useOnboardingState } from './use-onboarding-state';
import { WelcomeStep } from './welcome-step';

// The auth step lives at a fixed slot right after the welcome screen. Once a
// session is active it is skipped by navigation (not by the step itself), so
// back and next never bounce off a self-advancing screen.
const AUTH_INDEX = 1;

interface OnboardingFlowProps {
  readonly onFinished: () => void;
}

export function OnboardingFlow({ onFinished }: OnboardingFlowProps) {
  const session = useSession();
  const [step, setStep] = useState(0);
  const [featureIndex, setFeatureIndex] = useState(0);
  const {
    completeOnboarding,
    draft,
    setAiComfort,
    setRole,
    toggleInterest,
    toggleLocation,
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
  const stepCount = includePasskey ? 9 : 8;

  const goNext = useCallback(() => {
    setStep((current) => {
      let next = Math.min(stepCount - 1, current + 1);
      if (next === AUTH_INDEX && isSignedIn) {
        next = Math.min(stepCount - 1, next + 1);
      }
      return next;
    });
  }, [isSignedIn, stepCount]);

  const goBack = useCallback(() => {
    setStep((current) => {
      let prev = Math.max(0, current - 1);
      if (prev === AUTH_INDEX && isSignedIn) {
        prev = Math.max(0, prev - 1);
      }
      return prev;
    });
  }, [isSignedIn]);

  const handleDone = useCallback(() => {
    // Never strand the user on the celebration screen: navigate even if
    // persisting completion or submitting the profile rejects.
    void completeOnboarding().finally(onFinished);
  }, [completeOnboarding, onFinished]);

  const chrome = (skippable: boolean): ReactNode => (
    <ObHeader
      onBack={goBack}
      onSkip={goNext}
      skippable={skippable}
      step={step}
      total={stepCount}
    />
  );

  const steps: readonly ReactNode[] = [
    <WelcomeStep key="welcome" onNext={goNext} />,
    <AuthStep key="auth" onBack={goBack} onNext={goNext} />,
    <RoleStep
      chrome={chrome(true)}
      key="role"
      onNext={goNext}
      onPick={setRole}
      value={draft.role}
    />,
    <InterestsStep
      chrome={chrome(true)}
      key="interests"
      onNext={goNext}
      onToggle={toggleInterest}
      picks={draft.interests}
    />,
    <FeatureStep
      chrome={chrome(true)}
      index={featureIndex}
      key="features"
      locationGranted={draft.locationGranted}
      onIndexChange={setFeatureIndex}
      onLocationToggle={toggleLocation}
      onNext={goNext}
    />,
    <AiStep
      chrome={chrome(true)}
      key="ai"
      onNext={goNext}
      onPick={setAiComfort}
      value={draft.aiComfort}
    />,
    <NotificationsStep
      chrome={chrome(true)}
      key="notifications"
      onNext={goNext}
      onToggle={toggleNotification}
      prefs={draft.notificationPrefs}
    />,
    ...(includePasskey ? [<PasskeyStep key="passkey" onNext={goNext} />] : []),
    <CommitStep key="commit" onDone={handleDone} />,
  ];

  return <View className="flex-1 bg-canvas">{steps[step]}</View>;
}
