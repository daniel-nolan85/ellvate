import { Platform } from 'react-native';

import { requestJson } from '@/src/services/api';

type GetToken = () => Promise<string | null>;

const platformName = (): 'ios' | 'android' | 'web' => {
  if (Platform.OS === 'ios') {
    return 'ios';
  }
  return Platform.OS === 'android' ? 'android' : 'web';
};

// Registers this device for push and stores the Expo token. The native modules
// are imported lazily and the whole flow is guarded, so on a simulator or a
// build where the native module isn't linked yet it silently no-ops instead of
// crashing. Real delivery requires a physical device.
export async function registerForPushNotifications(
  getAccessToken: GetToken,
): Promise<void> {
  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');
    const Constants = (await import('expo-constants')).default;

    if (!Device.isDevice) {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        importance: Notifications.AndroidImportance.DEFAULT,
        name: 'Default',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) {
      return;
    }

    await requestJson({
      body: { platform: platformName(), token },
      getAccessToken,
      method: 'POST',
      path: '/api/me/push-token',
    });
  } catch {
    // Missing native module (build not yet rebuilt), denied permission, or a
    // network failure — push is best-effort and must never crash the app.
  }
}
