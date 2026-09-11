import AsyncStorage from '@react-native-async-storage/async-storage';

// WHY: AsyncStorage flag, not a server-side one -- mirrors the
// `@llv:<feature>-v1` convention already used for other one-time,
// device-local gates (see forum/use-pin-explainer.ts). A per-device flag is
// enough here: the native review prompt is itself throttled by the OS --
// iOS caps how often it will actually show a dialog to a given user
// regardless of how often the app asks, and Android's In-App Review API
// makes no promise it will show at all -- so there's nothing extra a
// server-side record would buy beyond what's already enforced natively.
const REVIEW_PROMPTED_KEY = '@llv:review-prompted-v1';

// Apple's guidelines explicitly prohibit gating the system review prompt
// behind a custom "enjoying the app?" screen that only shows it to people
// who answer yes -- this calls the native prompt directly, with no
// intermediate UI of our own. The OS alone decides whether anything is
// actually shown to a given user; this only decides *when to ask*, once,
// the first time a mission is completed (works the same on iOS and Android
// -- StoreReview wraps StoreKit on iOS and the Play Core In-App Review API
// on Android).
export async function maybeRequestReviewAfterFirstMissionComplete(): Promise<void> {
  const alreadyPrompted =
    (await AsyncStorage.getItem(REVIEW_PROMPTED_KEY)) === 'true';
  if (alreadyPrompted) {
    return;
  }
  // Set the flag before requesting, not after -- a request that throws (no
  // native module available, e.g. in Expo Go) must not leave this callable
  // again on the very next mission completion.
  await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, 'true');

  try {
    // WHY dynamic import, not a static one at the top of this file:
    // expo-store-review's native module binding runs the moment its JS
    // wrapper is evaluated (`requireNativeModule('ExpoStoreReview')` at
    // that module's own top level, not inside a function), throwing
    // immediately if the native module isn't compiled into the running
    // binary yet. A static import here would put that throw on this
    // file's own module-evaluation path -- and since expo-router eagerly
    // requires every route file to build its navigation tree, any route
    // that transitively imports this module (missions, in this case)
    // would crash on *every app launch*, not just when a mission is
    // completed. This app ships this feature over OTA updates before the
    // native build that actually adds the module reaches everyone, so
    // that gap is real, not hypothetical -- deferring the import to here,
    // inside a try/catch, means a binary without the native module yet
    // just silently skips the prompt instead of crashing the app.
    const StoreReview = await import('expo-store-review');
    const available = await StoreReview.isAvailableAsync();
    if (!available) {
      return;
    }
    await StoreReview.requestReview();
  } catch {
    // Native module not available in this binary yet (OTA update ahead of
    // the build that adds it) -- nothing to do.
  }
}
