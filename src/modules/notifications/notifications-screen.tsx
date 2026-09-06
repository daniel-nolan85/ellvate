import { FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';
import { CommunityNavBar } from '@/src/modules/community-shell';

import {
  resolveNotificationRoute,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from './use-notifications';

const ICON_BY_KIND: Readonly<Record<string, AppIconName>> = {
  comment: 'MessageCircle',
  digest: 'Newspaper',
  event: 'CalendarDays',
  like: 'Favourite',
  mission: 'Star',
};

const iconForKind = (kind: string): AppIconName => ICON_BY_KIND[kind] ?? 'Bell';

function NotificationRow({
  notification,
  onPress,
}: {
  readonly notification: Notification;
  readonly onPress: (notification: Notification) => void;
}) {
  const unread = notification.readAt === null;

  return (
    <Pressable
      accessibilityLabel={notification.title}
      accessibilityRole="button"
      className="flex-row gap-3 px-5 py-3.5"
      onPress={() => onPress(notification)}
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-secondary">
        <Icon name={iconForKind(notification.kind)} size={16} />
      </View>
      <VStack className="flex-1 gap-0.5">
        <HStack className="items-center justify-between gap-2">
          <Text
            className={
              unread
                ? 'flex-1 font-inter-bold text-[14px] text-content'
                : 'flex-1 font-inter-semibold text-[14px] text-text-muted'
            }
          >
            {notification.title}
          </Text>
          <Text className="text-[12px] text-text-muted">
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </HStack>
        <Text className="text-[13px] text-text-muted">{notification.body}</Text>
      </VStack>
      {unread ? (
        <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
      ) : null}
    </Pressable>
  );
}

export function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items =
    notifications.data?.pages.flatMap((page) => page.notifications) ?? [];
  const hasUnread = items.some((notification) => notification.readAt === null);

  const handlePress = (notification: Notification) => {
    if (notification.readAt === null) {
      markRead.mutate(notification.id);
    }
    const route = resolveNotificationRoute(notification.data);
    if (route) {
      // Plain push, not a dismiss-then-present: this screen is a plain
      // pushed screen now (see app/_layout.tsx), not a formSheet or modal,
      // so it no longer needs to get out of the way before the destination
      // can present correctly -- two earlier attempts at sequencing that
      // dismiss (a straight back()+push(), then back() with a delay before
      // push()) both still left the destination squashed, because
      // react-native-screens#3569's real precondition turned out not to be
      // "two navigation calls fired close together" but "a formSheet
      // presented directly over another still-transitioning presentation"
      // -- which no longer describes this screen at all now that it isn't
      // presented natively in any special way, so there's nothing left to
      // sequence around. The destination simply pushes on top; going back
      // reveals Notifications again, same as going back from anything else
      // reached by drilling into something.
      router.push(route);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* No manual close button -- summoned like `assistant` (see
          app/_layout.tsx), a plain pushed screen with a slide-up
          transition, not a modal or formSheet -- keeping Notifications
          specifically out of any special native presentation means
          whatever it links to never presents over another presented
          screen. A plain push renders flush with the physical top edge
          (unlike modal/formSheet's own inset page-sheet behavior), so this
          needs real insets.top, matching assistant-screen.tsx's own header.
          collapsable={false} works around a real react-native-screens bug
          (software-mansion/react-native-screens#3092): a screen whose root
          View has a background color can have RN's view-flattening
          optimization collapse this header's native view into its parent,
          which then lets the ScrollView below render on top of it instead
          of below it -- forcing this view to actually exist natively is
          the documented fix. */}
      <HStack
        className="items-center justify-between px-5 pb-3"
        collapsable={false}
        style={{ paddingTop: insets.top + 16 }}
      >
        <Heading className="font-inter-bold" size="xl">
          Notifications
        </Heading>
      </HStack>

      {hasUnread ? (
        <Pressable
          accessibilityLabel="Mark all as read"
          accessibilityRole="button"
          className="self-end px-5 pb-2"
          onPress={() => markAllRead.mutate()}
        >
          <Text className="font-inter-semibold text-[13px] text-accent">
            Mark all as read
          </Text>
        </Pressable>
      ) : null}

      {notifications.isPending ? (
        <VStack className="items-center py-16">
          <Spinner size="xlarge" />
        </VStack>
      ) : items.length === 0 ? (
        <VStack className="items-center gap-2 px-8 py-16" space="sm">
          <Icon name="Bell" size={28} />
          <Text className="text-center text-[14px] text-text-muted">
            All caught up — nothing here yet.
          </Text>
        </VStack>
      ) : (
        // FlatList, not a ScrollView + `.map()` -- see activity-parts.tsx's
        // ActivitySectionList for why: only rows actually on/near screen
        // mount as real native views here, no matter how many notifications
        // accumulate for a user over time.
        <FlatList
          contentContainerStyle={{ paddingBottom: 130 }}
          data={items}
          ItemSeparatorComponent={Divider}
          keyExtractor={(notification) => notification.id}
          ListFooterComponent={
            notifications.isFetchingNextPage ? (
              <View className="items-center py-4">
                <Spinner size="small" />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (
              notifications.hasNextPage &&
              !notifications.isFetchingNextPage
            ) {
              void notifications.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          onRefresh={() => void notifications.refetch()}
          refreshing={notifications.isRefetching}
          renderItem={({ item }) => (
            <NotificationRow notification={item} onPress={handlePress} />
          )}
        />
      )}

      <CommunityNavBar />
    </View>
  );
}
