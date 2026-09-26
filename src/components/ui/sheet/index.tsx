import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPEN_DURATION = 280;
// Exported so callers that navigate away on tap (rather than just dismissing)
// can delay that navigation until the close animation finishes, instead of
// unmounting the screen mid-slide.
export const CLOSE_DURATION = 220;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
// Off-screen offset used before the panel has measured its own height.
const HIDDEN_OFFSET = 900;
// Minimum clearance kept between the safe-area top (the notch/status bar)
// and the sheet's own top edge, on top of insets.top itself.
const MIN_TOP_GAP = 16;
// Height of the drag-handle row above `children` (pt-4 + h-1 dot + pb-2.5),
// subtracted from the panel's own maxHeight to get the space actually left
// for content -- see `maxContentHeight` below.
const HANDLE_AREA_HEIGHT = 30;

interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  // A plain node for content that's always short enough to fit. For content
  // that can be long enough to need its own internal ScrollView (e.g. a
  // form), pass a function instead: it receives the space actually left for
  // content after the handle, safe area, and live keyboard height are all
  // accounted for, so that inner ScrollView can be sized to exactly what's
  // left rather than a guessed constant that stops working the moment the
  // keyboard (or a taller header) eats into the room it assumed it had.
  readonly children: ReactNode | ((maxContentHeight: number) => ReactNode);
  // False for a sheet the caller wants a deliberate in-content action to
  // dismiss (e.g. a required consent checkbox) -- blocks the backdrop tap,
  // drag-to-dismiss, and hardware back button that would otherwise close it.
  readonly dismissable?: boolean;
}

// A lightweight Instagram-style bottom sheet built on reanimated + gesture
// handler: slides up over a dimmed backdrop, drag the handle down to
// dismiss, tap the backdrop to close, and rises with the keyboard. (Drag-to-
// dismiss is scoped to the handle only, not the whole panel -- see the
// GestureDetector below for why.)
export function Sheet({
  children,
  dismissable = true,
  onClose,
  visible,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useSharedValue(HIDDEN_OFFSET);
  const height = useSharedValue(HIDDEN_OFFSET);

  const unmount = useCallback(() => setMounted(false), []);

  // KeyboardAvoidingView (behavior below) pushes this whole bottom-anchored
  // panel further up by the keyboard's height on top of whatever height it
  // already has -- a panel already sized close to `maxHeight` (e.g. Edit
  // Profile's long form, with an autoFocus field that opens the keyboard
  // immediately) then gets shoved up past the safe area entirely, hiding the
  // drag handle and making the sheet impossible to dismiss. Tracking the
  // keyboard's own height and subtracting it from maxHeight below keeps the
  // panel's top edge pinned at the same safe distance from the top
  // regardless of whether the keyboard is open.
  //
  // iOS and Android fire different event names here: iOS has a Will-variant
  // that fires just before the keyboard animates in/out (letting this stay
  // in sync with the keyboard's own animation), while Android has no
  // Will-variant at all -- only Did, which fires once the keyboard has
  // already finished showing. Subscribing to 'keyboardWillShow' on Android
  // silently never fires, which used to leave this Sheet with no keyboard
  // awareness there at all -- exactly the class of "content squished behind
  // the keyboard inside a modal" bug that plagues RN's <Modal> on Android,
  // since (unlike a plain pushed screen) a Modal's own window doesn't get
  // Android's automatic adjustResize handling for free.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    if (visible) {
      translateY.value = withTiming(0, {
        duration: OPEN_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      translateY.value = withTiming(
        height.value || HIDDEN_OFFSET,
        { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            runOnJS(unmount)();
          }
        },
      );
      // Backstop: unmount does otherwise depend entirely on the worklet's
      // `finished` callback firing. If it never does (a broken/hung
      // worklet), this Sheet's full-screen Modal and backdrop would
      // otherwise stay mounted forever, silently swallowing every touch on
      // the screen behind it -- force the unmount after a small margin past
      // the animation's own duration so that failure mode can't be
      // permanent.
      const backstop = setTimeout(unmount, CLOSE_DURATION + 150);
      return () => clearTimeout(backstop);
    }
  }, [visible, mounted, translateY, height, unmount]);

  const requestClose = useCallback(() => {
    if (!dismissable) {
      return;
    }
    Keyboard.dismiss();
    onClose();
  }, [dismissable, onClose]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        requestClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [mounted, requestClose]);

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (!dismissable) {
        return;
      }
      translateY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (!dismissable) {
        return;
      }
      if (
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY
      ) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withTiming(0, { duration: 180 });
      }
    });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const measured = height.value || HIDDEN_OFFSET;
    const shown = 1 - Math.min(1, translateY.value / measured);
    return { opacity: shown * 0.5 };
  });

  if (!mounted) {
    return null;
  }

  const panelMaxHeight = windowHeight - insets.top - MIN_TOP_GAP - keyboardHeight;
  const maxContentHeight = Math.max(
    0,
    panelMaxHeight - HANDLE_AREA_HEIGHT - insets.bottom - 12,
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
      transparent
      visible
    >
      {/* 'height' rather than Android's usual `undefined` (which relies on
          the OS's automatic adjustResize) -- this whole tree lives inside
          the <Modal> above, a separate native Dialog window that Android's
          Activity-level adjustResize does not reach, so without an explicit
          behavior here the keyboard would simply overlap this panel's
          fields on Android with no avoidance at all. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityLabel="Close"
          className="absolute inset-0"
          onPress={requestClose}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'black',
              },
              backdropStyle,
            ]}
          />
        </Pressable>
        <Animated.View
          onLayout={(event) => {
            height.value = event.nativeEvent.layout.height;
          }}
          style={[
            panelStyle,
            {
              backgroundColor: 'rgb(253,247,237)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              // A flat percentage of the *full* screen height (the Modal is
              // statusBarTranslucent, so its coordinate space spans behind
              // the notch/status bar too) reserved only a flat 8% gap at
              // the top regardless of device -- not guaranteed to clear the
              // real safe-area inset. Unusually tall content (e.g. Edit
              // Profile's form) could then render its drag handle under the
              // notch. Bounding by the actual inset plus a fixed margin --
              // and by the live keyboard height, since the keyboard-
              // avoiding padding below pushes this same panel further up
              // still -- means the sheet can never physically extend past
              // the safe area, whatever the content's height or whether
              // the keyboard is open.
              maxHeight: panelMaxHeight,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          {/* The drag-to-dismiss gesture is scoped to just this handle row,
              not the whole panel below it -- an earlier version wrapped all
              of `children` in the same GestureDetector too, which let this
              raw, unconstrained Pan gesture claim any vertical drag over the
              panel (title fields, chips, the whole form) before a child
              ScrollView's own native scroll responder ever got a chance,
              making long content impossible to scroll no matter how it was
              bounded further down. `translateY` is a shared reanimated
              value read by `panelStyle` above on the *parent* Animated.View,
              so scoping the gesture to just this row still slides the whole
              sheet when the handle itself is dragged. */}
          <GestureDetector gesture={pan}>
            <View className="items-center pb-2.5 pt-4">
              <View className="h-1 w-10 rounded-full bg-line" />
            </View>
          </GestureDetector>
          {typeof children === 'function'
            ? children(maxContentHeight)
            : children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
