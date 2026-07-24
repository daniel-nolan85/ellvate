import type { ReactNode } from 'react';

import { Pressable, View } from 'react-native';

import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { ObCta, ObTitle } from './chrome';
import type { CommunityRole } from './use-onboarding-state';

interface RoleOption {
  readonly id: CommunityRole;
  readonly icon: AppIconName;
  readonly title: string;
  readonly sub: string;
}

export const ROLES: readonly RoleOption[] = [
  { icon: 'Globe', id: 'resident', sub: 'Resident of Lake Las Vegas', title: 'I live here' },
  { icon: 'Star', id: 'new', sub: 'Just moved (or about to)', title: "I'm new to the area" },
  {
    icon: 'AtSign',
    id: 'business',
    sub: 'Restaurant, shop, service…',
    title: 'I run a local business',
  },
  { icon: 'CalendarDays', id: 'visitor', sub: 'Here for events & fun', title: "I'm visiting" },
];

interface RoleStepProps {
  readonly value: CommunityRole | null;
  readonly onPick: (role: CommunityRole) => void;
  readonly onNext: () => void;
  readonly chrome: ReactNode;
}

export function RoleStep({ value, onPick, onNext, chrome }: RoleStepProps) {
  return (
    <View className="flex-1 bg-canvas">
      {chrome}
      <ObTitle
        eyebrow="About you"
        sub="We tailor the feed, events and missions to you."
        title="Who are you here as?"
      />
      <View className="gap-2.5 px-5 py-3.5">
        {ROLES.map((role) => {
          const selected = value === role.id;
          return (
            <Pressable
              accessibilityRole="button"
              className={`flex-row items-center gap-3.5 rounded-[18px] px-4 py-[15px] ${
                selected
                  ? 'border border-primary bg-primary shadow-card'
                  : 'border border-surface-hairline bg-paper shadow-card'
              }`}
              key={role.id}
              onPress={() => onPick(role.id)}
              testID={`onboarding-role-${role.id}`}
            >
              <View
                className={`h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${
                  selected ? 'bg-[rgba(250,250,250,0.12)]' : 'bg-accent-subtle'
                }`}
              >
                <Icon
                  color={selected ? '#fff' : 'rgb(181,80,44)'}
                  name={role.icon}
                  size={18}
                />
              </View>
              <View className="flex-1">
                <Text
                  className={`font-inter-semibold text-[15px] ${
                    selected ? 'text-primary-foreground' : 'text-content'
                  }`}
                >
                  {role.title}
                </Text>
                <Text
                  className={`mt-0.5 text-[12px] ${
                    selected ? 'text-[rgba(250,250,250,0.6)]' : 'text-text-muted'
                  }`}
                >
                  {role.sub}
                </Text>
              </View>
              {selected ? <Icon color="#fff" name="CheckCircle" size={20} /> : null}
            </Pressable>
          );
        })}
      </View>
      <ObCta disabled={!value} label="Continue" onPress={onNext} />
      <View className="h-[26px]" />
    </View>
  );
}
