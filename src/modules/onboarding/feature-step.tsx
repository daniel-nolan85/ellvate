import React, { type ReactNode } from 'react';

import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { LeaderRow, type LeaderboardEntry } from '@/src/modules/leaderboard';

import { ObCta } from './chrome';

const ACCENT = 'rgb(181,80,44)';
const AMBER = 'rgb(217,123,41)';
const WHITE = 'rgb(255,255,255)';
const CONTENT = 'rgb(37,30,23)';

// Each preview below is a static, non-interactive stand-in for the real
// card component it's named after (PostCard, EventRow, MissionCard,
// ServiceListingCard) — built from the same shared UI primitives and class
// names so it stays visually honest about what the feature actually looks
// like, without mounting the real card's network-backed bits (bookmarks,
// mutations) against fake data. LeaderboardArt is the one exception: LeaderRow
// itself is purely presentational, so it's reused directly against fabricated
// entries — zero drift risk since it IS the real row.
function ForumArt() {
  return (
    <View className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card">
      <HStack className="items-center" space="sm">
        <Avatar name="Jordan Diaz" size="sm" />
        <VStack className="flex-1" space="xs">
          <Text className="font-inter-bold" size="sm">
            Jordan Diaz
          </Text>
          <HStack className="items-center" space="xs">
            <Badge variant="lake">Marina &amp; Boating</Badge>
            <Text className="text-text-muted" size="xs">
              · 4h
            </Text>
          </HStack>
        </VStack>
      </HStack>
      <VStack space="xs">
        <Heading className="font-inter-bold tracking-[-0.36px]" size="md">
          Best spots to kayak at sunrise?
        </Heading>
        <Text className="leading-[21px] text-text-muted" size="sm">
          New to the lake — where do you all put in before the wind picks up?
        </Text>
      </VStack>
      <HStack className="items-center" space="sm">
        <HStack className="items-center gap-1.5 rounded-full bg-amber-subtle px-3 py-[7px]">
          <Icon color={AMBER} fill={AMBER} name="Favourite" size={14} />
          <Text className="font-inter-semibold text-[12px] leading-[16px] text-amber">24</Text>
        </HStack>
        <HStack className="items-center gap-1.5 rounded-full bg-secondary px-3 py-[7px]">
          <Icon color={CONTENT} name="MessageCircle" size={14} />
          <Text className="font-inter-semibold text-[12px] leading-[16px] text-content">9</Text>
        </HStack>
      </HStack>
    </View>
  );
}

function EventsArt() {
  return (
    <HStack className="items-center gap-3 rounded-[18px] border border-surface-hairline bg-paper p-3.5 shadow-card">
      <VStack className="w-12 items-center rounded-[14px] bg-accent-subtle py-[9px]" space="xs">
        <Text className="font-inter-bold text-[10px] leading-[12px] tracking-[0.5px] text-accent">
          FRI
        </Text>
        <Text className="font-inter-bold text-[19px] leading-[20px] text-accent">18</Text>
      </VStack>
      <VStack className="min-w-0 flex-1" space="xs">
        <Text className="font-inter-bold tracking-[-0.14px] text-content" size="sm">
          Locals Networking Mixer
        </Text>
        <Text className="text-muted-foreground" size="xs">
          6:30 PM · MonteLago Village
        </Text>
        <Text className="text-text-subtle" size="xs">
          48 going
        </Text>
      </VStack>
      <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary">
        <Icon color={CONTENT} name="Add" size={16} />
      </View>
    </HStack>
  );
}

const MISSION_SEGMENTS: readonly boolean[] = [true, true, false];

function MissionsArt() {
  return (
    <View className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card">
      <HStack className="items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-accent-subtle">
          <Icon color={ACCENT} name="Sun" size={20} />
        </View>
        <VStack className="flex-1 gap-1">
          <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
            Sunrise at the Marina
          </Text>
          <Text className="text-muted-foreground" size="xs">
            Check in at Village Marina before 8 AM.
          </Text>
        </VStack>
      </HStack>
      <HStack className="items-center gap-2">
        <HStack className="flex-1 gap-1">
          {MISSION_SEGMENTS.map((filled, index) => (
            <View
              className={`h-[5px] flex-1 rounded-full ${filled ? 'bg-accent' : 'bg-muted'}`}
              key={index}
            />
          ))}
        </HStack>
        <Text className="shrink-0 text-muted-foreground" size="xs">
          2/3 stops
        </Text>
        <Badge leftIcon={<Icon color={AMBER} name="Star" size={11} />} variant="amber">
          50 XP
        </Badge>
      </HStack>
    </View>
  );
}

function ServicesArt() {
  return (
    <HStack className="items-center gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card">
      <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-amber-subtle">
        <Icon color={AMBER} name="Utensils" size={20} />
      </View>
      <VStack className="flex-1 gap-1">
        <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
          Lakeside Bistro
        </Text>
        <HStack className="items-center gap-2">
          <Badge variant="amber">Dining</Badge>
          <HStack className="items-center gap-1">
            <Icon color={AMBER} fill={AMBER} name="Star" size={12} />
            <Text className="font-inter-semibold text-[12px] text-content">4.8</Text>
            <Text className="text-text-muted" size="xs">
              (32)
            </Text>
          </HStack>
        </HStack>
      </VStack>
    </HStack>
  );
}

const LEADERBOARD_PREVIEW: readonly LeaderboardEntry[] = [
  {
    isMe: false,
    missionsCompleted: 41,
    rank: 1,
    rankDelta: 0,
    user: { avatarUrl: null, id: 'preview-1', name: 'Mia Lake' },
    xp: 3820,
  },
  {
    isMe: true,
    missionsCompleted: 21,
    rank: 6,
    rankDelta: 1,
    user: { avatarUrl: null, id: 'preview-me', name: 'You' },
    xp: 1980,
  },
];

function LeaderboardArt() {
  return (
    <VStack space="sm">
      {LEADERBOARD_PREVIEW.map((entry) => (
        <LeaderRow entry={entry} key={entry.user.id} />
      ))}
    </VStack>
  );
}

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
      <Icon color={granted ? WHITE : CONTENT} name="Globe" size={18} />
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

export interface Moment {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly sub: string;
  readonly proof: string;
  readonly locationAsk: boolean;
  readonly art: () => ReactNode;
}

export const MOMENTS: readonly Moment[] = [
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
  {
    art: () => <ServicesArt />,
    eyebrow: 'SERVICES',
    id: 'services',
    locationAsk: false,
    proof: '60+ local businesses listed by neighbours',
    sub: 'Find (and recommend) the restaurants, shops and services locals actually trust.',
    title: 'Skip the search, ask the lake',
  },
  {
    art: () => <LeaderboardArt />,
    eyebrow: 'LEADERBOARD',
    id: 'leaderboard',
    locationAsk: false,
    proof: 'Ranked by missions completed this month',
    sub: 'Every mission you finish moves you up the board — see how you stack up against your neighbours.',
    title: 'Climb the ranks',
  },
];

interface MomentStepProps {
  readonly moment: Moment;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
  readonly locationGranted?: boolean;
  readonly onLocationToggle?: () => void;
}

export function MomentStep({
  chrome,
  locationGranted,
  moment,
  onLocationToggle,
  onNext,
}: MomentStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <View className="flex-1 justify-center px-6">
        <Animated.View className="gap-5" entering={FadeIn.duration(250)} key={moment.id}>
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
            <Text className="font-inter-medium text-[12px] text-accent">{moment.proof}</Text>
          </View>
          {moment.locationAsk && onLocationToggle ? (
            <LocationCard granted={locationGranted ?? false} onToggle={onLocationToggle} />
          ) : null}
        </Animated.View>
      </View>
      <ObCta label="Next" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}
