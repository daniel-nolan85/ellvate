import { Pressable } from 'react-native';

import { router } from 'expo-router';

import { Box } from '@/src/components/ui/box';
import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

import { useNotifications } from './use-notifications';

// A persistent entry point to the notifications inbox, shown on every screen
// title alongside the profile avatar — mirrors ProfileAvatarButton's role.
export function NotificationBellButton() {
  const notifications = useNotifications();
  const unreadCount =
    notifications.data?.notifications.filter((notification) => !notification.readAt)
      .length ?? 0;

  return (
    <Pressable
      accessibilityLabel={
        unreadCount > 0
          ? `Open notifications, ${unreadCount} unread`
          : 'Open notifications'
      }
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.push('/notifications')}
    >
      <Box className="relative p-1">
        <Icon name="Bell" size={22} />
        {unreadCount > 0 ? (
          <Box className="absolute -right-0.5 -top-0.5 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1">
            <Text className="font-inter-bold text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </Box>
        ) : null}
      </Box>
    </Pressable>
  );
}
