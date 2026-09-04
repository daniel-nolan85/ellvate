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
  // On this react-native-screens version, a formSheet screen's own root
  // `flex: 1` View does NOT reliably get stretched to the sheet's full
  // allocated (detent) height on iOS -- it renders at its intrinsic content
  // height instead and sticks to the top, leaving the rest of the visually
  // full-height sheet blank below it. That reads as every screen's content
  // being squeezed into a short strip at the top ("smushed"), which neither
  // of this shared config's other two options (headerShown, and each
  // screen's own collapsable={false} header fix) could touch -- both target
  // a header/z-order problem, not a content-sizing one. Setting the content
  // container's height explicitly (rather than depending on flex to resolve
  // it) is react-native-screens' own documented workaround.
  contentStyle: { height: '100%' },
};
