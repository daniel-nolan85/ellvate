import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// Shared options for every dismissible-overlay screen (Notifications,
// Digest, someone else's Profile/Activity) -- a native formSheet gets an
// OS-drawn grabber, swipe-to-dismiss, and tap-outside-to-close for free,
// instead of each screen hand-rolling an X button and its own insets.top
// math. 'large' is a single tall detent (not resizable between sizes, just
// dismissible), matching the feel of the Sheet component used everywhere
// else in the app.
export const SHEET_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'formSheet',
  // A single full-height detent -- this version's types only accept an
  // array of fractional heights or 'fitToContents', not the newer
  // 'large'/'medium' identifiers.
  sheetAllowedDetents: [1],
  sheetCornerRadius: 24,
  sheetGrabberVisible: true,
  // The parent <Stack>'s screenOptions already sets headerShown: false, but
  // formSheet is a distinct native presentation style from the plain push/
  // modal ones every other screen in that shared config uses -- without
  // setting it again here explicitly, a formSheet screen renders its own
  // native header bar overlapping this screen's own custom heading and the
  // first row of content beneath it.
  headerShown: false,
};
