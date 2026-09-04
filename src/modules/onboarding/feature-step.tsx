import React, { type ReactNode } from 'react';

import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AiMark } from '@/src/components/ui/ai-mark';
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
const CONTENT = 'rgb(37,30,23)';
const LAKE = 'rgb(47,110,114)';

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
        // Decorative preview shown during onboarding, before the viewer has
        // a session or community access -- nothing real to navigate to yet.
        <LeaderRow entry={entry} key={entry.user.id} onPress={() => {}} />
      ))}
      <HStack className="items-center gap-1.5 self-start rounded-full bg-amber-subtle px-3 py-[7px]">
        <Icon color={AMBER} fill={AMBER} name="Star" size={12} />
        <Text className="font-inter-semibold text-[12px] leading-[16px] text-amber">
          Earn XP, level up, climb the board
        </Text>
      </HStack>
    </VStack>
  );
}

function PetitionsArt() {
  return (
    <View className="gap-2.5 rounded-[16px] border border-surface-hairline bg-paper p-4 shadow-card">
      <Badge variant="muted">Safety</Badge>
      <Text className="font-inter-bold text-[15px] leading-[20px] tracking-[-0.15px] text-content">
        Add lighting to the marina walkway
      </Text>
      <VStack space="xs">
        <View className="h-2 overflow-hidden rounded-full bg-secondary">
          <View className="h-full w-[60%] rounded-full bg-accent" />
        </View>
        <Text className="text-[12px] text-text-muted">120 of 200 signatures</Text>
      </VStack>
    </View>
  );
}

function DigestStatBox({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <VStack className="flex-1 items-center rounded-2xl bg-secondary py-3" space="xs">
      <Text className="font-inter-bold text-[18px] text-content">{value}</Text>
      <Text className="text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

function DigestArt() {
  return (
    <View className="gap-3 rounded-[20px] border border-surface-hairline bg-paper p-4 shadow-card">
      <HStack space="sm">
        <DigestStatBox label="Posts" value={12} />
        <DigestStatBox label="Events" value={3} />
        <DigestStatBox label="Active" value={48} />
      </HStack>
      <HStack className="items-center gap-1.5 self-start rounded-full bg-lake-subtle px-3 py-[7px]">
        <Icon color={LAKE} name="Newspaper" size={12} />
        <Text className="font-inter-semibold text-[12px] leading-[16px] text-lake">
          Everything you missed, one recap
        </Text>
      </HStack>
    </View>
  );
}

function AssistantArt() {
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] bg-accent p-3.5 shadow-card">
      <View className="h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px] bg-[rgba(255,255,255,0.18)]">
        <AiMark color="#fff" size={18} />
      </View>
      <Text className="flex-1 font-sans text-[13px] leading-[19px] text-accent-foreground">
        &quot;Any networking events this weekend?&quot; — ask me things like that,
        anytime.
      </Text>
    </View>
  );
}

export interface Moment {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly sub: string;
  readonly art: () => ReactNode;
}

export const MOMENTS: readonly Moment[] = [
  {
    art: () => <ForumArt />,
    eyebrow: 'FORUM',
    id: 'forum',
    sub: 'Ask anything, share finds, and get answers from people who actually live here.',
    title: 'Never feel like a stranger at the lake',
  },
  {
    art: () => <EventsArt />,
    eyebrow: 'EVENTS',
    id: 'events',
    sub: 'Every mixer, market and fountain show — one calendar, one tap to join.',
    title: 'Never miss what’s happening',
  },
  {
    art: () => <MissionsArt />,
    eyebrow: 'MISSIONS',
    id: 'missions',
    sub: 'Check in at real places around the lake, earn XP, keep a streak — moving feels better with a scoreboard.',
    title: 'Turn your walks into wins',
  },
  {
    art: () => <ServicesArt />,
    eyebrow: 'SERVICES',
    id: 'services',
    sub: 'Find (and recommend) the restaurants, shops and services locals actually trust.',
    title: 'Skip the search, ask the lake',
  },
  {
    art: () => <LeaderboardArt />,
    eyebrow: 'LEADERBOARD',
    id: 'leaderboard',
    sub: 'Every mission earns XP, levels you up, and moves you up the board — see how you stack up against your neighbours.',
    title: 'Climb the ranks',
  },
  {
    art: () => <PetitionsArt />,
    eyebrow: 'PETITIONS',
    id: 'petitions',
    sub: 'Once the community is big enough, real signatures from real neighbours can send a request straight to the HOA board.',
    title: 'A respectful way to be heard',
  },
  {
    art: () => <DigestArt />,
    eyebrow: 'WEEKLY DIGEST',
    id: 'digest',
    sub: "A recap every week — the posts everyone was talking about, the events that happened, and what's coming up next.",
    title: 'Never wonder what you missed',
  },
  {
    art: () => <AssistantArt />,
    eyebrow: 'LAKE ASSISTANT',
    id: 'assistant',
    sub: 'It searches live events, forum posts, missions and services to answer — available to everyone, anytime.',
    title: 'Or just ask',
  },
];

interface MomentStepProps {
  readonly moment: Moment;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function MomentStep({ chrome, moment, onNext }: MomentStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <View className="flex-1 justify-center px-6">
        <Animated.View className="gap-5" entering={FadeIn.duration(250)} key={moment.id}>
          <View className="pb-2">{moment.art()}</View>
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
        </Animated.View>
      </View>
      <ObCta label="Next" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}
