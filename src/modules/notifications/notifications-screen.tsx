import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { useLoadMoreOnScroll } from '@/src/components/shared/use-load-more-on-scroll';
import { Divider } from '@/src/components/ui/divider';
import { Heading } from '@/src/components/ui/heading';
import { HStack } from '@/src/components/ui/hstack';
import { Icon, type AppIconName } from '@/src/components/ui/icon';
import { Spinner } from '@/src/components/ui/spinner';
import { Text } from '@/src/components/ui/text';
import { VStack } from '@/src/components/ui/vstack';
import { formatRelativeTime } from '@/src/lib/relative-time';

import {
  resolveNotificationRoute,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from './use-notifications';

interface NotificationsScreenProps {
  readonly onClose: () => void;
}

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
      {unread ? <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" /> : null}
    </Pressable>
  );
}

export function NotificationsScreen({ onClose }: NotificationsScreenProps) {
  const insets = useSafeAreaInsets();
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items =
    notifications.data?.pages.flatMap((page) => page.notifications) ?? [];
  const hasUnread = items.some((notification) => notification.readAt === null);

  const onScroll = useLoadMoreOnScroll([
    {
      fetchNextPage: notifications.fetchNextPage,
      hasNextPage: notifications.hasNextPage,
      isFetchingNextPage: notifications.isFetchingNextPage,
    },
  ]);

  const handlePress = (notification: Notification) => {
    if (notification.readAt === null) {
      markRead.mutate(notification.id);
    }
    const route = resolveNotificationRoute(notification.data);
    if (route) {
      onClose();
      router.push(route);
    }
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* No manual close button -- this screen is presented as a native
          formSheet (see app/_layout.tsx), whose own grabber, swipe-to-
          dismiss, and tap-outside already cover closing it. A `formSheet`
          page's content starts well below the physical top edge, so this
          only needs a small fixed gap, not insets.top -- unlike Sheet's
          statusBarTranslucent custom Modal, which spans behind the notch. */}
      <HStack className="items-center justify-between px-5 pb-3 pt-6">
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
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          onScroll={onScroll}
          scrollEventThrottle={100}
        >
          {items.map((notification, index) => (
            <View key={notification.id}>
              <NotificationRow notification={notification} onPress={handlePress} />
              {index < items.length - 1 ? <Divider /> : null}
            </View>
          ))}
          {notifications.isFetchingNextPage ? (
            <View className="items-center py-4">
              <Spinner size="small" />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
