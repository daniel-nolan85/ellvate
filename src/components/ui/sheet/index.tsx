import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  // False for a sheet the caller wants a deliberate in-content action to
  // dismiss (e.g. a required consent checkbox) -- blocks the backdrop tap,
  // drag-to-dismiss, and hardware back button that would otherwise close it.
  readonly dismissable?: boolean;
}

// A lightweight Instagram-style bottom sheet built on reanimated + gesture
// handler: slides up over a dimmed backdrop, drag the handle (or the sheet) down
// to dismiss, tap the backdrop to close, and rises with the keyboard.
export function Sheet({
  children,
  dismissable = true,
  onClose,
  visible,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(HIDDEN_OFFSET);
  const height = useSharedValue(HIDDEN_OFFSET);

  const unmount = useCallback(() => setMounted(false), []);

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

  return (
    <Modal
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
        <GestureDetector gesture={pan}>
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
                maxHeight: '92%',
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <View className="items-center pb-1 pt-2.5">
              <View className="h-1 w-10 rounded-full bg-line" />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
  );
}
