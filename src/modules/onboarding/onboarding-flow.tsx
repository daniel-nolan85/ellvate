import React, { useCallback, useState, type ReactNode } from 'react';

import { View } from 'react-native';

import { AiStep } from './ai-step';
import { AuthStep } from './auth-step';
import { ObHeader } from './chrome';
import { CommitStep } from './commit-step';
import { FeatureStep } from './feature-step';
import { InterestsStep } from './interests-step';
import { NotificationsStep } from './notifications-step';
import { RoleStep } from './role-step';
import { useOnboardingState } from './use-onboarding-state';
import { WelcomeStep } from './welcome-step';

const TOTAL_STEPS = 8;

interface OnboardingFlowProps {
  readonly onFinished: () => void;
}

export function OnboardingFlow({ onFinished }: OnboardingFlowProps) {
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

  const goNext = useCallback(() => {
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  }, []);

  const goBack = useCallback(() => {
    setStep((current) => Math.max(0, current - 1));
  }, []);

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
      total={TOTAL_STEPS}
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
    <CommitStep key="commit" onDone={handleDone} />,
  ];

  return <View className="flex-1 bg-canvas">{steps[step]}</View>;
}
