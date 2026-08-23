import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { useUserProfileModal } from '@clerk/expo';

import { Avatar } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';
import { Button, ButtonText } from '@/src/components/ui/button';
import { ConfirmModal } from '@/src/components/ui/confirm-modal';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Input, InputField } from '@/src/components/ui/input';
import { Sheet } from '@/src/components/ui/sheet';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { CommunityNavBar, ScreenTitle } from '@/src/modules/community-shell';
import {
  INTERESTS,
  MAX_PICKS,
  MIN_PICKS,
  resetOnboardingComplete,
  ROLES,
} from '@/src/modules/onboarding';
import { getClerkConfiguration } from '@/src/platform/environment';
import { pickAvatarImage } from '@/src/platform/media-picker';
import { useSession } from '@/src/platform/session';

import {
  useDeleteAccount,
  useMemberProfile,
  useProfile,
  useProfileStats,
  useUpdateProfile,
  type CommunityRole,
  type NotificationPrefs,
} from './use-profile';

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
  {
    key: 'petitions',
    label: 'Petitions',
    hint: 'When a petition you signed succeeds or gets a board response',
    icon: 'FileSignature',
  },
];

// Hosted on the marketing site (../web/app/terms, ../web/app/privacy), not
// as native routes -- there's no real domain yet (see EXPO_PUBLIC_MARKETING_URL
// in .env.example), so these rows fall back to a disabled state instead of a
// broken link until one exists.
const MARKETING_URL = process.env.EXPO_PUBLIC_MARKETING_URL?.trim() || null;

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
  description,
  icon,
  label,
  onPress,
  right,
  value,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly value?: string;
  // A longer explanation of what the row/toggle does, shown on its own line
  // below the icon+label instead of squeezed into the same row as `right` —
  // use this instead of `value` when there's also a `right` control such as
  // a Switch, so the description text doesn't compete for horizontal space.
  readonly description?: string;
  readonly right?: ReactNode;
  readonly onPress?: () => void;
  readonly danger?: boolean;
}) {
  return (
    <Pressable
      className="gap-1 border-b border-surface-hairline px-4 py-3.5"
      disabled={!onPress}
      onPress={onPress}
    >
      <View className="flex-row items-center gap-3">
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
      </View>
      {description ? (
        <Text className="pl-11 text-text-muted" size="xs">
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

// useUserProfileModal() calls Clerk's useClerk() internally, which throws
// outside a mounted ClerkProvider — and ClerkSessionProvider skips mounting
// one entirely when auth is disabled/misconfigured. Isolating the hook call
// in its own component (only rendered once Clerk is confirmed configured)
// keeps that call unconditional within its own instance without crashing
// the rest of the screen in disabled/misconfigured environments.
function ClerkPhonePasswordRow() {
  const { isAvailable, presentUserProfile } = useUserProfileModal();

  return (
    <Row
      icon="Phone"
      label="Phone & password"
      onPress={isAvailable ? () => void presentUserProfile() : undefined}
      value={isAvailable ? undefined : 'Use the mobile app'}
    />
  );
}

function PhonePasswordRow() {
  if (getClerkConfiguration().status !== 'ready') {
    return (
      <Row
        icon="Phone"
        label="Phone & password"
        value="Not available in this build"
      />
    );
  }
  return <ClerkPhonePasswordRow />;
}

function StatCard({
  label,
  onPress,
  value,
}: {
  readonly label: string;
  readonly value: string;
  readonly onPress?: () => void;
}) {
  return (
    <Pressable
      className="flex-1 items-center rounded-2xl border border-surface-hairline bg-paper py-3.5 shadow-card"
      disabled={!onPress}
      onPress={onPress}
    >
      <VStack className="items-center" space="xs">
        <Text className="font-inter-bold text-[20px] text-content">{value}</Text>
        <Text className="text-text-muted" size="xs">
          {label}
        </Text>
      </VStack>
    </Pressable>
  );
}

function LevelProgress({
  level,
  xpForNextLevel,
  xpIntoLevel,
  xpToNextLevel,
}: {
  readonly level: number;
  readonly xpIntoLevel: number;
  readonly xpForNextLevel: number;
  readonly xpToNextLevel: number;
}) {
  const pct = xpForNextLevel > 0
    ? Math.min(100, Math.max(0, (xpIntoLevel / xpForNextLevel) * 100))
    : 0;

  return (
    <VStack className="mx-5 mt-3 gap-2 rounded-2xl border border-surface-hairline bg-paper px-4 py-3.5 shadow-card">
      <HStack className="items-center justify-between">
        <Text className="font-inter-semibold text-content" size="sm">
          Level {level}
        </Text>
        <Text className="text-text-muted" size="xs">
          {xpToNextLevel} XP to Level {level + 1}
        </Text>
      </HStack>
      <View className="h-2 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </View>
    </VStack>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const profile = useProfile();
  const stats = useProfileStats();
  const activity = useMemberProfile(session.userId ?? 'demo-user');
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [activeSheet, setActiveSheet] = useState<'edit' | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftRole, setDraftRole] = useState<CommunityRole | null>(null);
  const [draftInterests, setDraftInterests] = useState<readonly string[]>([]);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const displayName =
    profile.data?.profile.name ??
    (session.status === 'signed-in' ? 'You' : 'Demo member');
  const prefs = profile.data?.profile.notificationPrefs;
  const currentRole = profile.data?.profile.role ?? null;
  const currentRoleOption = currentRole
    ? ROLES.find((role) => role.id === currentRole)
    : undefined;
  // Falls back to the generic tagline until a role is picked -- the role
  // options themselves are phrased in the first person ("I live here"), so
  // they read naturally as a caption under your own name.
  const subtitle = currentRoleOption?.title ?? 'Lake Las Vegas neighbour';

  const openEditProfile = () => {
    setDraftName(profile.data?.profile.name ?? '');
    setDraftRole(profile.data?.profile.role ?? null);
    setDraftInterests(profile.data?.profile.interests ?? []);
    setActiveSheet('edit');
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

  const toggleDraftInterest = (interest: string) => {
    setDraftInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }
      if (current.length >= MAX_PICKS) {
        return current;
      }
      return [...current, interest];
    });
  };

  // Name is the only field required to save -- role and interests are
  // included only when they're individually in a valid state, so fixing
  // just your name doesn't get blocked by an unset role or a still-partial
  // interests pick.
  const saveProfile = () => {
    const name = draftName.trim();
    if (!name) {
      return;
    }
    updateProfile.mutate(
      {
        name,
        ...(draftRole ? { role: draftRole } : {}),
        ...(draftInterests.length >= MIN_PICKS ? { interests: draftInterests } : {}),
      },
      { onSuccess: () => setActiveSheet(null) },
    );
  };

  const toggle = (key: keyof NotificationPrefs, next: boolean) => {
    updateProfile.mutate({ notificationPrefs: { [key]: next } });
  };

  // WHY: session.signOut() is a no-op with EXPO_PUBLIC_AUTH_MODE=disabled (no
  // real session to end). Clearing the onboarding flag and replacing to the
  // index route is what gives delete-account a visible effect in that mode
  // (the account, and everything it picked during onboarding, is genuinely
  // gone either way, so re-running the wizard is always correct here) — and
  // it still routes correctly once a real auth mode is wired up.
  const finishDeleteAccount = async () => {
    try {
      await session.signOut();
    } finally {
      await resetOnboardingComplete();
      router.replace('/');
    }
  };

  const handleSignOut = () => {
    setSignOutOpen(false);
    // A plain sign-out (not delete) leaves the account and its onboarding
    // choices intact server-side, so a real session shouldn't be forced back
    // through the whole onboarding wizard to get back in -- /auth renders the
    // real sign-in screen directly. Demo mode has no real session to sign
    // back into, so it keeps the onboarding-reset behavior that's the only
    // thing giving "Sign out" a visible effect there.
    const wasDemoMode = session.status === 'disabled';
    void (async () => {
      try {
        await session.signOut();
      } finally {
        if (wasDemoMode) {
          await resetOnboardingComplete();
          router.replace('/');
        } else {
          router.replace('/auth');
        }
      }
    })();
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setDeleteAccountOpen(false);
        void finishDeleteAccount();
      },
      onError: () => {
        setDeleteAccountOpen(false);
        showToast("Couldn't delete your account. Try again.");
      },
    });
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
            onPress={openEditProfile}
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

        {stats.data ? (
          <LevelProgress
            level={stats.data.level}
            xpForNextLevel={stats.data.xpForNextLevel}
            xpIntoLevel={stats.data.xpIntoLevel}
            xpToNextLevel={stats.data.xpToNextLevel}
          />
        ) : null}

        <SectionTitle>Shortcuts</SectionTitle>
        <SectionCard>
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

        {profile.data && profile.data.profile.interests.length > 0 ? (
          <>
            <SectionTitle>Interests</SectionTitle>
            <Pressable onPress={openEditProfile}>
              <HStack className="mx-5 flex-wrap gap-2">
                {profile.data.profile.interests.map((interest) => (
                  <Badge key={interest} variant="accent">
                    {interest}
                  </Badge>
                ))}
              </HStack>
            </Pressable>
          </>
        ) : null}

        <SectionTitle>Activity</SectionTitle>
        <HStack className="mx-5" space="sm">
          <StatCard
            label="Posts"
            onPress={() => router.push('/activity?filter=post')}
            value={String(activity.data?.stats.postsCount ?? 0)}
          />
          <StatCard
            label="Events"
            onPress={() => router.push('/activity?filter=event')}
            value={String(
              (activity.data?.stats.eventsCreated ?? 0) +
                (activity.data?.stats.eventsAttended ?? 0),
            )}
          />
          <StatCard
            label="Missions"
            onPress={() => router.push('/activity?filter=mission')}
            value={String(activity.data?.stats.missionsCreated ?? 0)}
          />
          <StatCard
            label="Services"
            onPress={() => router.push('/activity?filter=service')}
            value={String(activity.data?.stats.servicesListed ?? 0)}
          />
        </HStack>

        <SectionTitle>Privacy</SectionTitle>
        <SectionCard>
          <Row
            description="Visible to others"
            icon="Eye"
            label="Share activity"
            right={
              <Switch
                onValueChange={(next) =>
                  updateProfile.mutate({ activityVisible: next })
                }
                value={profile.data?.profile.activityVisible ?? false}
              />
            }
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
                description={row.hint}
                icon={row.icon}
                key={row.key}
                label={row.label}
                right={
                  <Switch
                    onValueChange={(next) => toggle(row.key, next)}
                    value={prefs[row.key]}
                  />
                }
              />
            ))}
          </SectionCard>
        )}

        <SectionTitle>Account</SectionTitle>
        <SectionCard>
          <PhonePasswordRow />
          <Row icon="Mail" label="Contact us" onPress={() => router.push('/contact')} />
          <Row
            icon="FileText"
            label="Terms of Service"
            onPress={
              MARKETING_URL
                ? () => void Linking.openURL(`${MARKETING_URL}/terms`)
                : undefined
            }
            value={MARKETING_URL ? undefined : 'Not available yet'}
          />
          <Row
            icon="FileText"
            label="Privacy Policy"
            onPress={
              MARKETING_URL
                ? () => void Linking.openURL(`${MARKETING_URL}/privacy`)
                : undefined
            }
            value={MARKETING_URL ? undefined : 'Not available yet'}
          />
          <Row icon="ArrowLeft" label="Sign out" onPress={() => setSignOutOpen(true)} />
          <Row
            danger
            icon="AlertCircle"
            label="Delete account"
            onPress={() => setDeleteAccountOpen(true)}
          />
        </SectionCard>
      </ScrollView>

      <Sheet onClose={() => setActiveSheet(null)} visible={activeSheet !== null}>
        {activeSheet === 'edit' ? (
          <VStack className="px-5 pb-2 pt-1" space="md">
            <Text className="font-inter-bold text-[17px] text-content">
              Edit profile
            </Text>
            <ScrollView style={{ maxHeight: 440 }}>
              <VStack space="lg">
                <VStack space="xs">
                  <Text className="font-inter-semibold text-content" size="sm">
                    Name
                  </Text>
                  <Text className="text-text-muted" size="xs">
                    This is how neighbours see you on posts and the leaderboard.
                  </Text>
                  <Input size="lg">
                    <InputField
                      autoFocus
                      onChangeText={setDraftName}
                      onSubmitEditing={saveProfile}
                      placeholder="First name"
                      value={draftName}
                    />
                  </Input>
                </VStack>

                <VStack space="xs">
                  <Text className="font-inter-semibold text-content" size="sm">
                    Community role
                  </Text>
                  <VStack space="xs">
                    {ROLES.map((role) => {
                      const selected = draftRole === role.id;
                      return (
                        <Pressable
                          accessibilityRole="button"
                          className={`flex-row items-center gap-3 rounded-2xl px-4 py-3 ${
                            selected
                              ? 'border border-primary bg-primary'
                              : 'border border-surface-hairline bg-canvas'
                          }`}
                          key={role.id}
                          onPress={() => setDraftRole(role.id)}
                          testID={`profile-role-${role.id}`}
                        >
                          <Icon
                            color={selected ? '#fff' : 'rgb(181,80,44)'}
                            name={role.icon}
                            size={18}
                          />
                          <View className="flex-1">
                            <Text
                              className={`font-inter-semibold text-[14px] ${
                                selected ? 'text-primary-foreground' : 'text-content'
                              }`}
                            >
                              {role.title}
                            </Text>
                            <Text
                              className={`text-[12px] ${
                                selected ? 'text-[rgba(250,250,250,0.6)]' : 'text-text-muted'
                              }`}
                            >
                              {role.sub}
                            </Text>
                          </View>
                          {selected ? (
                            <Icon color="#fff" name="CheckCircle" size={18} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </VStack>
                </VStack>

                <VStack className="pb-1" space="xs">
                  <Text className="font-inter-semibold text-content" size="sm">
                    Interests
                  </Text>
                  <Text className="text-text-muted" size="xs">
                    Pick {MIN_PICKS}–{MAX_PICKS} things you&apos;re into.
                  </Text>
                  <View className="flex-row flex-wrap gap-2 pb-1">
                    {INTERESTS.map((interest) => {
                      const selected = draftInterests.includes(interest);
                      return (
                        <Pressable
                          accessibilityRole="button"
                          className={`rounded-full px-4 py-2.5 ${
                            selected ? 'bg-primary' : 'bg-secondary'
                          }`}
                          key={interest}
                          onPress={() => toggleDraftInterest(interest)}
                          testID={`profile-interest-${interest.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                        >
                          <Text
                            className={`font-inter-medium text-[13px] ${
                              selected ? 'text-primary-foreground' : 'text-content'
                            }`}
                          >
                            {interest}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </VStack>
              </VStack>
            </ScrollView>
            <Button
              className="h-[52px] rounded-2xl bg-accent"
              isDisabled={draftName.trim().length === 0 || updateProfile.isPending}
              onPress={saveProfile}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-accent-foreground">
                {updateProfile.isPending ? 'Saving…' : 'Save'}
              </ButtonText>
            </Button>
          </VStack>
        ) : null}
      </Sheet>

      <ConfirmModal
        confirmLabel="Sign out"
        destructive
        message="You can sign back in any time."
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
        title="Sign out?"
        visible={signOutOpen}
      />

      <ConfirmModal
        confirmLabel={deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
        destructive
        message="This permanently deletes your posts, comments, reviews, and bookmarks. Events and missions you created stay up for the community but no longer show your name. This can't be undone."
        onClose={() => setDeleteAccountOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete account?"
        visible={deleteAccountOpen}
      />

      {toast ? (
        <View
          className="absolute left-[18px] right-[18px] flex-row items-center gap-2.5 rounded-[10px] bg-primary px-4 py-3"
          style={{ bottom: insets.bottom + 96 }}
        >
          <Icon color="rgb(250,250,250)" name="AlertCircle" size={16} />
          <Text className="flex-1 text-[14px] text-primary-foreground">
            {toast}
          </Text>
        </View>
      ) : null}

      <CommunityNavBar />
    </View>
  );
}
