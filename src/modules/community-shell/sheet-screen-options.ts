import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// Shared options for the formSheet-presented dismissible overlays (Digest,
// someone else's Profile) -- a native formSheet gets an OS-drawn grabber,
// swipe-to-dismiss, and tap-outside-to-close for free, instead of each
// screen hand-rolling an X button and its own insets.top math. 'large' is a
// single tall detent (not resizable between sizes, just dismissible),
// matching the feel of the Sheet component used everywhere else in the app.
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

// For a formSheet screen that used to always be reached by chaining
// directly off another formSheet screen (Notifications -> Digest on every
// notification tap; Member Profile -> Member Activity from its stat cards).
// That combination -- a formSheet presented over another formSheet, with a
// ScrollView inside -- hits a confirmed upstream bug (software-mansion/
// react-native-screens#3569): the newly-presented sheet's content height
// comes out wrong, reproducing exactly as this app's "smushed at the top"
// reports, worsening rather than resolving on repeated back-and-forth.
//
// Notifications itself no longer uses this at all -- it's a plain pushed
// screen now (see app/_layout.tsx), specifically so nothing it links to
// ever presents over another presented screen, of any kind, rather than
// narrowing the fix to "not over specifically another formSheet" and
// re-litigating that scope every time a new destination turned out to
// still be affected (which Digest was, even after Notifications alone
// stopped being a formSheet). Digest and Member Activity keep this --
// they're each still one formSheet deep from a plain screen (Notifications,
// Member Profile), which was never the reported problem. Digest's other
// entry point (a direct icon tap from Profile) gets a modal instead of a
// formSheet too, a minor, acceptable style difference there. Member Profile
// keeps the full formSheet treatment for its many other entry points
// (search, leaderboard, forum, ...), since only the Member Activity side of
// that pair was ever reported broken.
export const MODAL_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  presentation: 'modal',
  headerShown: false,
  contentStyle: { height: '100%' },
};
