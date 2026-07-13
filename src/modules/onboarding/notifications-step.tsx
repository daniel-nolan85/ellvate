import React, { type ReactNode } from 'react';

import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta, ObTitle } from './chrome';
import type { NotificationPrefs } from './use-onboarding-state';

const INDIGO = 'rgb(99,102,241)';
const TEXT_SUBTLE = 'rgb(161,161,170)';

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

function NotifSwitch({ on }: { readonly on: boolean }) {
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withTiming(on ? 18 : 0, { duration: 180 }) }],
  }));

  return (
    <View
      className={`h-[26px] w-[44px] rounded-full p-[3px] ${
        on ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <Animated.View
        className="h-5 w-5 rounded-full bg-white"
        style={[
          thumbStyle,
          {
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { height: 1, width: 0 },
            shadowOpacity: 0.2,
            shadowRadius: 3,
          },
        ]}
      />
    </View>
  );
}

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
        eyebrow="Stay in the loop"
        sub="Only what you pick — never marketing spam."
        title="What's worth a ping?"
      />
      <View className="flex-1 gap-2.5 px-5 py-4">
        {NOTIF_OPTS.map((option) => {
          const on = prefs[option.id];
          return (
            <Pressable
              className="flex-row items-center gap-3.5 rounded-[18px] border border-line bg-canvas px-4 py-[13px]"
              key={option.id}
              onPress={() => onToggle(option.id)}
            >
              <Icon
                color={on ? INDIGO : TEXT_SUBTLE}
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
              <NotifSwitch on={on} />
            </Pressable>
          );
        })}
      </View>
      <ObCta label="Continue" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}
