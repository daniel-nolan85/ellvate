import React, { type ReactNode } from 'react';

import { Switch, View } from 'react-native';

import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta, ObTitle } from './chrome';
import type { NotificationPrefs } from './use-onboarding-state';

const ACCENT = 'rgb(181,80,44)';
const TEXT_SUBTLE = 'rgb(169,156,139)';

interface NotifOption {
  readonly id: keyof NotificationPrefs;
  readonly icon: AppIconName;
  readonly title: string;
  readonly sub: string;
}

const NOTIF_OPTS: readonly NotifOption[] = [
  {
    icon: 'CalendarDays',
    id: 'events',
    sub: 'Day-of nudges for events you joined',
    title: 'Event reminders',
  },
  {
    icon: 'MessageCircle',
    id: 'replies',
    sub: 'When someone answers your post',
    title: 'Forum replies',
  },
  {
    icon: 'Star',
    id: 'missions',
    sub: 'New missions nearby, streak about to break',
    title: 'Mission & streak alerts',
  },
  {
    icon: 'Mail',
    id: 'digest',
    sub: 'Monday morning: the week at the lake',
    title: 'Weekly digest',
  },
];

interface NotificationsStepProps {
  readonly prefs: NotificationPrefs;
  readonly onToggle: (key: keyof NotificationPrefs) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function NotificationsStep({
  chrome,
  onNext,
  onToggle,
  prefs,
}: NotificationsStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <ObTitle
        eyebrow="Notifications"
        sub="Choose what you'd like to be notified about — never marketing spam, and you can change these anytime in your profile."
        title="What should we let you know about?"
      />
      <View className="flex-1 gap-2.5 px-5 py-4">
        {NOTIF_OPTS.map((option) => {
          const on = prefs[option.id];
          return (
            <View
              className="flex-row items-center gap-3.5 rounded-[18px] border border-surface-hairline bg-paper px-4 py-[13px] shadow-card"
              key={option.id}
            >
              <Icon
                color={on ? ACCENT : TEXT_SUBTLE}
                name={option.icon}
                size={18}
              />
              <View className="flex-1">
                <Text className="font-inter-semibold text-[14px] text-content">
                  {option.title}
                </Text>
                <Text className="mt-0.5 font-sans text-[12px] text-text-muted">
                  {option.sub}
                </Text>
              </View>
              <Switch
                onValueChange={() => onToggle(option.id)}
                testID={`onboarding-notif-${option.id}`}
                value={on}
              />
            </View>
          );
        })}
      </View>
      <ObCta label="Continue" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}
