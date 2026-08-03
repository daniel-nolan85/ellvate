import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
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
import { INTERESTS, MAX_PICKS, MIN_PICKS, ROLES } from '@/src/modules/onboarding';
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

export function ProfileScreen({ onClose }: { readonly onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const profile = useProfile();
  const stats = useProfileStats();
  const activity = useMemberProfile(session.userId ?? 'demo-user');
  const updateProfile = useUpdateProfile();
  const deleteAccount = useDeleteAccount();

  const [activeSheet, setActiveSheet] = useState<
    'name' | 'role' | 'interests' | null
  >(null);
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
  const subtitle = 'Lake Las Vegas neighbour';
  const prefs = profile.data?.profile.notificationPrefs;
  const currentRole = profile.data?.profile.role ?? null;
  const roleLabel = currentRole
    ? (ROLES.find((role) => role.id === currentRole)?.title ?? '—')
    : '—';

  const openNameEdit = () => {
    setDraftName(profile.data?.profile.name ?? '');
    setActiveSheet('name');
  };

  const openRoleEdit = () => {
    setDraftRole(profile.data?.profile.role ?? null);
    setActiveSheet('role');
  };

  const openInterestsEdit = () => {
    setDraftInterests(profile.data?.profile.interests ?? []);
    setActiveSheet('interests');
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
      { onSuccess: () => setActiveSheet(null) },
    );
  };

  const saveRole = () => {
    if (!draftRole) {
      return;
    }
    updateProfile.mutate(
      { role: draftRole },
      { onSuccess: () => setActiveSheet(null) },
    );
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

  const saveInterests = () => {
    if (draftInterests.length < MIN_PICKS) {
      return;
    }
    updateProfile.mutate(
      { interests: draftInterests },
      { onSuccess: () => setActiveSheet(null) },
    );
  };

  const toggle = (key: keyof NotificationPrefs, next: boolean) => {
    updateProfile.mutate({ notificationPrefs: { [key]: next } });
  };

  const handleSignOut = () => {
    setSignOutOpen(false);
    void session.signOut().finally(onClose);
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setDeleteAccountOpen(false);
        void session.signOut().finally(onClose);
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
            onPress={openNameEdit}
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
            onPress={openRoleEdit}
            value={roleLabel}
          />
          <Row
            icon="Star"
            label="Interests"
            onPress={openInterestsEdit}
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

        {profile.data && profile.data.profile.interests.length > 0 ? (
          <>
            <SectionTitle>Interests</SectionTitle>
            <Pressable onPress={openInterestsEdit}>
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
            value="Visible to others"
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
          <PhonePasswordRow />
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
        {activeSheet === 'name' ? (
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
        ) : null}

        {activeSheet === 'role' ? (
          <VStack className="px-5 pb-2 pt-1" space="md">
            <Text className="font-inter-bold text-[17px] text-content">
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
            <Button
              className="h-[52px] rounded-2xl bg-accent"
              isDisabled={!draftRole || updateProfile.isPending}
              onPress={saveRole}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-accent-foreground">
                {updateProfile.isPending ? 'Saving…' : 'Save'}
              </ButtonText>
            </Button>
          </VStack>
        ) : null}

        {activeSheet === 'interests' ? (
          <VStack className="px-5 pb-2 pt-1" space="md">
            <Text className="font-inter-bold text-[17px] text-content">
              Interests
            </Text>
            <Text className="text-text-muted" size="sm">
              Pick {MIN_PICKS}–{MAX_PICKS} things you&apos;re into.
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
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
            </ScrollView>
            <Button
              className="h-[52px] rounded-2xl bg-accent"
              isDisabled={draftInterests.length < MIN_PICKS || updateProfile.isPending}
              onPress={saveInterests}
              size="lg"
            >
              <ButtonText className="font-inter-semibold text-accent-foreground">
                {updateProfile.isPending
                  ? 'Saving…'
                  : `Save (${draftInterests.length}/${MAX_PICKS})`}
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
