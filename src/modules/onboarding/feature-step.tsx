import React, { type ReactNode } from 'react';

import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta } from './chrome';

const ACCENT = 'rgb(181,80,44)';
const WHITE = 'rgb(255,255,255)';
const FOREGROUND = 'rgb(37,30,23)';

function ForumArt() {
  return (
    <View className="gap-2">
      <View className="max-w-[80%] self-start rounded-[16px] rounded-bl-[4px] bg-secondary px-3.5 py-2.5">
        <Text className="font-sans text-[13px] text-content">
          Best spots to kayak at sunrise?
        </Text>
      </View>
      <View className="max-w-[80%] self-end rounded-[16px] rounded-br-[4px] bg-primary px-3.5 py-2.5">
        <Text className="font-sans text-[13px] text-primary-foreground">
          Put in at the village marina before 7 — glass water
        </Text>
      </View>
    </View>
  );
}

function EventsArt() {
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-surface-hairline bg-paper p-3.5 shadow-card">
      <View className="w-[46px] items-center rounded-[12px] bg-accent-subtle py-2">
        <Text className="font-inter-bold text-[9px] tracking-[0.5px] text-accent">
          FRI
        </Text>
        <Text className="font-inter-bold text-[18px] text-accent">18</Text>
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-[14px] text-content">
          Locals Networking Mixer
        </Text>
        <Text className="mt-0.5 font-sans text-[11px] text-text-muted">
          6:30 PM · MonteLago Village
        </Text>
      </View>
      <View className="rounded-full bg-accent px-3.5 py-2">
        <Text className="font-inter-semibold text-[12px] text-accent-foreground">
          Join
        </Text>
      </View>
    </View>
  );
}

const MISSION_SEGMENTS: readonly boolean[] = [true, true, false];

function MissionsArt() {
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] bg-primary p-3.5">
      <View className="h-10 w-10 items-center justify-center rounded-[12px] bg-[rgba(250,250,250,0.12)]">
        <Icon color={ACCENT} name="Sun" size={18} />
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-[14px] text-primary-foreground">
          Sunrise at the Marina
        </Text>
        <View className="mt-1.5 flex-row gap-1">
          {MISSION_SEGMENTS.map((filled, index) => (
            <View
              className={`h-1 flex-1 rounded-full ${
                filled ? 'bg-accent' : 'bg-[rgba(250,250,250,0.15)]'
              }`}
              key={index}
            />
          ))}
        </View>
      </View>
      <Text className="font-inter-bold text-[13px] text-accent">+50 XP</Text>
    </View>
  );
}

interface Moment {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly sub: string;
  readonly proof: string;
  readonly locationAsk: boolean;
  readonly art: () => ReactNode;
}

const MOMENTS: readonly Moment[] = [
  {
    art: () => <ForumArt />,
    eyebrow: 'FORUM',
    id: 'forum',
    locationAsk: false,
    proof: '31 posts answered in the last 24h',
    sub: 'Ask anything, share finds, and get answers from people who actually live here.',
    title: 'Never feel like a stranger at the lake',
  },
  {
    art: () => <EventsArt />,
    eyebrow: 'EVENTS',
    id: 'events',
    locationAsk: false,
    proof: '48 neighbours joined events this week',
    sub: 'Every mixer, market and fountain show — one calendar, one tap to join.',
    title: 'Never miss what’s happening',
  },
  {
    art: () => <MissionsArt />,
    eyebrow: 'MISSIONS',
    id: 'missions',
    locationAsk: true,
    proof: 'Top explorer logged 41 missions this month',
    sub: 'Check in at real places around the lake, earn XP, keep a streak — moving feels better with a scoreboard.',
    title: 'Turn your walks into wins',
  },
];

interface LocationCardProps {
  readonly granted: boolean;
  readonly onToggle: () => void;
}

function LocationCard({ granted, onToggle }: LocationCardProps) {
  return (
    <Pressable
      className={`flex-row items-center gap-3 rounded-[16px] px-[15px] py-[13px] ${
        granted ? 'bg-success' : 'bg-secondary'
      }`}
      onPress={onToggle}
    >
      <Icon color={granted ? WHITE : FOREGROUND} name="Globe" size={18} />
      <View className="flex-1">
        <Text
          className={`font-inter-semibold text-[13px] ${
            granted ? 'text-white' : 'text-content'
          }`}
        >
          {granted
            ? 'Location on — check-ins are automatic'
            : 'Allow location for auto check-ins'}
        </Text>
        {granted ? null : (
          <Text className="mt-0.5 font-sans text-[11px] text-text-muted">
            Only while using the app. You can change this anytime.
          </Text>
        )}
      </View>
      {granted ? <Icon color={WHITE} name="CheckCircle" size={18} /> : null}
    </Pressable>
  );
}

interface FeatureStepProps {
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
  readonly locationGranted: boolean;
  readonly onLocationToggle: () => void;
}

export function FeatureStep({
  chrome,
  index,
  locationGranted,
  onIndexChange,
  onLocationToggle,
  onNext,
}: FeatureStepProps) {
  const moment = MOMENTS[index] ?? MOMENTS[0];
  const isLast = index === MOMENTS.length - 1;

  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <View className="flex-1 justify-center px-6">
        <Animated.View
          className="gap-5"
          entering={FadeIn.duration(250)}
          key={moment.id}
        >
          {moment.art()}
          <View>
            <Text className="font-inter-bold text-[11px] tracking-[1.5px] text-accent">
              {moment.eyebrow}
            </Text>
            <Text className="mt-2 font-inter-bold text-[30px] leading-[34px] tracking-[-0.9px] text-content">
              {moment.title}
            </Text>
            <Text className="mt-2.5 leading-6 text-text-muted" size="md">
              {moment.sub}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 self-start rounded-full bg-accent-subtle px-3.5 py-2">
            <View className="h-1.5 w-1.5 rounded-full bg-accent" />
            <Text className="font-inter-medium text-[12px] text-accent">
              {moment.proof}
            </Text>
          </View>
          {moment.locationAsk ? (
            <LocationCard granted={locationGranted} onToggle={onLocationToggle} />
          ) : null}
        </Animated.View>
      </View>
      <View className="flex-row justify-center gap-1.5 py-1">
        {MOMENTS.map((entry, dotIndex) => (
          <Pressable
            className={`h-1.5 rounded-full ${
              dotIndex === index ? 'w-[22px] bg-primary' : 'w-1.5 bg-muted'
            }`}
            key={entry.id}
            onPress={() => onIndexChange(dotIndex)}
          />
        ))}
      </View>
      <ObCta
        label={isLast ? 'Continue' : 'Next'}
        onPress={() => (isLast ? onNext() : onIndexChange(index + 1))}
      />
      <View className="h-[26px]" />
    </View>
  );
}
