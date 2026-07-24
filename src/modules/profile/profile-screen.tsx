import { useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Avatar } from '@/src/components/ui/avatar';
import { Button, ButtonText } from '@/src/components/ui/button';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';
import { pickAvatarImage } from '@/src/platform/media-picker';
import { useSession } from '@/src/platform/session';

import {
  useProfile,
  useProfileStats,
  useUpdateProfile,
  type NotificationPrefs,
} from './use-profile';

const ROLE_LABELS: Record<string, string> = {
  resident: 'Resident',
  new: 'New to the area',
  business: 'Local business',
  visitor: 'Visitor',
};

const NOTIFICATION_ROWS: readonly {
  readonly key: keyof NotificationPrefs;
  readonly label: string;
  readonly hint: string;
  readonly icon: AppIconName;
}[] = [
  {
    key: 'events',
    label: 'Events',
    hint: 'New events around the lake',
    icon: 'CalendarDays',
  },
  {
    key: 'replies',
    label: 'Replies',
    hint: 'When someone answers your posts',
    icon: 'MessageCircle',
  },
  {
    key: 'missions',
    label: 'Missions',
    hint: 'New missions and XP',
    icon: 'Star',
  },
  {
    key: 'digest',
    label: 'Weekly digest',
    hint: 'Monday morning: the week at the lake',
    icon: 'Mail',
  },
];

function SectionTitle({ children }: { readonly children: string }) {
  return (
    <Text className="px-6 pb-1.5 pt-5 font-inter-bold text-[12px] uppercase tracking-[1px] text-text-muted">
      {children}
    </Text>
  );
}

function SectionCard({ children }: { readonly children: ReactNode }) {
  return (
    <VStack className="mx-5 overflow-hidden rounded-[18px] border border-surface-hairline bg-paper shadow-card">
      {children}
    </VStack>
  );
}

function Row({
  danger,
  icon,
  label,
  onPress,
  right,
  value,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly value?: string;
  readonly right?: ReactNode;
  readonly onPress?: () => void;
  readonly danger?: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center gap-3 border-b border-surface-hairline px-4 py-3.5"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-secondary">
        <Icon
          color={danger ? 'rgb(231,0,11)' : 'rgb(181,80,44)'}
          name={icon}
          size={16}
        />
      </View>
      <Text
        className={`flex-1 font-inter-medium text-[15px] ${danger ? 'text-destructive' : 'text-content'}`}
      >
        {label}
      </Text>
      {value ? (
        <Text className="text-text-muted" size="sm">
          {value}
        </Text>
      ) : null}
      {right}
      {onPress && !right ? (
        <Icon color="rgb(169,156,139)" name="ChevronLeft" size={16} />
      ) : null}
    </Pressable>
  );
}

function StatCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <VStack
      className="flex-1 items-center rounded-2xl border border-surface-hairline bg-paper py-3.5 shadow-card"
      space="xs"
    >
      <Text className="font-inter-bold text-[20px] text-content">{value}</Text>
      <Text className="text-text-muted" size="xs">
        {label}
      </Text>
    </VStack>
  );
}

export function ProfileScreen({ onClose }: { readonly onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const profile = useProfile();
  const stats = useProfileStats();
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  const displayName = session.status === 'signed-in' ? 'You' : 'Demo member';
  const subtitle = 'Lake Las Vegas neighbour';
  const prefs = profile.data?.profile.notificationPrefs;

  const openEdit = () => {
    setDraftName(session.status === 'signed-in' ? 'You' : '');
    setEditing(true);
  };

  const pickAvatar = async () => {
    const asset = await pickAvatarImage();
    if (!asset) {
      return;
    }
    updateProfile.mutate({
      avatar: {
        dataUrl: `data:${asset.mimeType};base64,${asset.base64}`,
        filename: asset.filename,
      },
    });
  };

  const saveName = () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    updateProfile.mutate(
      { name },
      { onSuccess: () => setEditing(false) },
    );
  };

  const toggle = (key: keyof NotificationPrefs, next: boolean) => {
    updateProfile.mutate({ notificationPrefs: { [key]: next } });
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { style: 'cancel', text: 'Cancel' },
      {
        onPress: () => {
          void session.signOut().finally(onClose);
        },
        style: 'destructive',
        text: 'Sign out',
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'Account deletion is managed by Clerk and is not available from this build yet.',
      [
        { text: 'OK' },
      ],
    );
  };

  return (
    <View className="flex-1 bg-canvas">
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitle eyebrow="Account" showAvatar={false} title="Profile" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 130 }}>
        <VStack className="mx-5 items-center gap-3 rounded-[20px] border border-surface-hairline bg-paper px-5 pb-5 pt-6 shadow-card">
          <Pressable
            accessibilityLabel="Change your photo"
            accessibilityRole="button"
            className="relative"
            disabled={updateProfile.isPending}
            onPress={pickAvatar}
          >
            <Avatar
              name={displayName}
              size="2xl"
              src={profile.data?.profile.avatarUrl ?? undefined}
            />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-paper bg-accent">
              {updateProfile.isPending ? (
                <Spinner size="small" />
              ) : (
                <Icon color="rgb(255,255,255)" name="Edit" size={14} />
              )}
            </View>
          </Pressable>
          <VStack className="items-center" space="xs">
            <Heading className="font-inter-bold" size="lg">
              {displayName}
            </Heading>
            <Text className="text-text-muted" size="sm">
              {subtitle}
            </Text>
          </VStack>
          <Button
            action="secondary"
            className="rounded-full bg-secondary px-5"
            onPress={openEdit}
            size="sm"
          >
            <ButtonText className="font-inter-semibold text-[13px] text-content">
              Edit profile
            </ButtonText>
          </Button>
        </VStack>

        <HStack className="px-5 pt-4" space="sm">
          <StatCard label="Level" value={String(stats.data?.level ?? 1)} />
          <StatCard label="XP" value={String(stats.data?.xp ?? 0)} />
          <StatCard
            label="Missions"
            value={String(stats.data?.missionsCompleted ?? 0)}
          />
          <StatCard label="Streak" value={String(stats.data?.streakDays ?? 0)} />
        </HStack>

        <SectionTitle>Your profile</SectionTitle>
        <SectionCard>
          <Row
            icon="Globe"
            label="Community role"
            value={
              profile.data?.profile.role
                ? ROLE_LABELS[profile.data.profile.role]
                : '—'
            }
          />
          <Row
            icon="Star"
            label="Interests"
            value={`${profile.data?.profile.interests.length ?? 0} picked`}
          />
          <Row
            icon="Edit"
            label="My Activity"
            onPress={() => router.push('/activity')}
          />
          <Row
            icon="Bookmark"
            label="Bookmarks"
            onPress={() => router.push('/bookmarks')}
          />
        </SectionCard>

        <SectionTitle>Notifications</SectionTitle>
        {profile.isPending || !prefs ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : (
          <SectionCard>
            {NOTIFICATION_ROWS.map((row) => (
              <Row
                icon={row.icon}
                key={row.key}
                label={row.label}
                right={
                  <Switch
                    onValueChange={(next) => toggle(row.key, next)}
                    value={prefs[row.key]}
                  />
                }
                value={row.hint}
              />
            ))}
          </SectionCard>
        )}

        <SectionTitle>Account</SectionTitle>
        <SectionCard>
          <Row icon="Phone" label="Phone & password" value="Managed by Clerk" />
          <Row icon="ArrowLeft" label="Sign out" onPress={confirmSignOut} />
          <Row danger icon="AlertCircle" label="Delete account" onPress={confirmDelete} />
        </SectionCard>
      </ScrollView>

      <Sheet onClose={() => setEditing(false)} visible={editing}>
        <VStack className="px-5 pb-2 pt-1" space="md">
          <Text className="font-inter-bold text-[17px] text-content">
            Your name
          </Text>
          <Text className="text-text-muted" size="sm">
            This is how neighbours see you on posts and the leaderboard.
          </Text>
          <Input size="lg">
            <InputField
              autoFocus
              onChangeText={setDraftName}
              onSubmitEditing={saveName}
              placeholder="First name"
              value={draftName}
            />
          </Input>
          <Button
            className="h-[52px] rounded-2xl bg-accent"
            isDisabled={draftName.trim().length === 0 || updateProfile.isPending}
            onPress={saveName}
            size="lg"
          >
            <ButtonText className="font-inter-semibold text-accent-foreground">
              {updateProfile.isPending ? 'Saving…' : 'Save'}
            </ButtonText>
          </Button>
        </VStack>
      </Sheet>

      <CommunityNavBar />
    </View>
  );
}
