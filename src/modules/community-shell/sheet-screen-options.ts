import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// Shared options for the formSheet-presented dismissible overlays (Digest,
// someone else's Profile, the notification/... duplicates of Post/Event/
// Mission/Petition) -- a native formSheet gets an OS-drawn grabber, swipe-
// to-dismiss, and tap-outside-to-close for free, instead of each screen
// hand-rolling an X button and its own insets.top math. 'large' is a single
// tall detent (not resizable between sizes, just dismissible), matching the
// feel of the Sheet component used everywhere else in the app.
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

// For Member Activity specifically, which is always reached by chaining
// directly off Member Profile, an already-presented formSheet. A formSheet
// presented over another formSheet, with a ScrollView inside, hits a
// confirmed upstream bug (software-mansion/react-native-screens#3569): the
// newly-presented sheet's content height comes out wrong, reproducing
// exactly as this app's "smushed at the top" reports, worsening rather than
// resolving on repeated back-and-forth. Member Profile keeps the full
// formSheet treatment (SHEET_SCREEN_OPTIONS) for its many other entry points
// (search, leaderboard, forum, ...), since only the Member Activity side of
// that one pair was ever reported broken -- so Member Activity alone gets
// this plain `modal` instead, avoiding the chain without touching Member
// Profile's own presentation. Every other screen that used to need this
// (Digest, the notification/... duplicates) is one formSheet deep from a
// plain screen, not another formSheet, so it uses SHEET_SCREEN_OPTIONS
// instead and gets the native grabber.
export const MODAL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'modal',
  headerShown: false,
  contentStyle: { height: '100%' },
};
