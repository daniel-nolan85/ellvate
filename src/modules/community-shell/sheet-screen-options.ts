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

// For a formSheet screen that's always reached by chaining directly off
// another formSheet screen (Notifications -> Digest on every notification
// tap; Member Profile -> Member Activity from its stat cards). That specific
// combination -- a formSheet presented over another formSheet, with a
// ScrollView inside -- hits a confirmed, currently-unfixed upstream bug
// (software-mansion/react-native-screens#3569): the newly-presented sheet's
// content height comes out wrong, reproducing exactly as this app's
// "smushed at the top" reports, and it gets worse on repeated back-and-forth
// rather than resolving. Three rounds of application-level fixes here
// (view-flattening's collapsable={false}, content-height's height: '100%',
// then sequencing the navigation transition itself) each fixed a real
// problem but never this one, because this one isn't fixable from this
// side of the native boundary -- it's in react-native-screens' own sheet
// content wrapper. The only reliable fix is to not put two formSheet
// screens back-to-back: this uses `modal` (no sheetAllowedDetents/height-
// resolution machinery, so the bug's precondition never applies) for
// whichever end of a formSheet pair is *always* reached by chaining off the
// other -- the destination still gets a plain, respectable native modal
// presentation, and the OTHER member of each pair (Digest, Member Profile)
// keeps the full formSheet treatment for its other, non-chained entry
// points (a direct icon tap, search, leaderboard, forum, ...).
export const MODAL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'modal',
  headerShown: false,
  contentStyle: { height: '100%' },
};
