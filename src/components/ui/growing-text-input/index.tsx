import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

import { Text } from '@/src/components/ui/text';

export interface GrowingTextInputProps {
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly autoFocus?: boolean;
  readonly testID?: string;
  // WHY: opt-in, not the default — a bare Enter submitting makes sense for a
  // short chat message, but would be surprising in a longer post/description
  // field where line breaks are part of the content.
  readonly submitOnEnter?: boolean;
  readonly onSubmitEditing?: () => void;
  // Hard character cap, enforced natively by TextInput (typing stops dead at
  // the limit). Whenever this is set, a live "N/max" counter is always shown
  // below the field.
  readonly maxLength?: number;
}

const DEFAULT_MIN_HEIGHT = 44;
const DEFAULT_MAX_HEIGHT = 160;

const clampHeight = (height: number, min: number, max: number) =>
  Math.min(max, Math.max(min, height));

// A multiline TextInput that wraps long text instead of scrolling it
// horizontally, and grows its own height to fit — up to maxHeight, beyond
// which it scrolls internally (scrollbar hidden via the `no-scrollbar` CSS
// class in global.css, web only). Native platforms grow via their own
// intrinsic multiline measurement (just a minHeight in style, no JS bridge
// event required) inside a small ScrollView that supplies the maxHeight cap
// and the actual scrolling -- a bare multiline TextInput doesn't reliably
// auto-scroll to keep the caret visible once its content exceeds the visible
// area on iOS, so scrolling the wrapper to the end on every keystroke keeps
// the caret in view while typing, while still letting the user freely drag
// back up to review earlier text (it snaps back to the end on the next
// keystroke, not while just reading). Web needs the manual scrollHeight
// measurement below since a plain <textarea> doesn't auto-size itself, and
// its own native scroll-to-caret behavior is already reliable, so it skips
// the ScrollView wrapper entirely.
export const GrowingTextInput = forwardRef<TextInput, GrowingTextInputProps>(
  function GrowingTextInput(
    {
      autoFocus,
      className,
      maxHeight = DEFAULT_MAX_HEIGHT,
      maxLength,
      minHeight = DEFAULT_MIN_HEIGHT,
      onChangeText,
      onSubmitEditing,
      placeholder,
      submitOnEnter = false,
      testID,
      value,
    },
    forwardedRef,
  ) {
    const [inputHeight, setInputHeight] = useState(minHeight);
    const inputRef = useRef<TextInput>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    useImperativeHandle(forwardedRef, () => inputRef.current as TextInput);

    // WHY: react-native-web's TextInput never fires onContentSizeChange —
    // that callback only exists on native iOS/Android — so on web the box
    // would stay pinned at minHeight forever without this. Read the
    // underlying <textarea>'s scrollHeight directly instead. Re-measuring on
    // every `value` change (not just user keystrokes) also covers the case
    // where the parent clears/resets the value externally, e.g. after
    // submit. A textarea already taller than its content reports
    // scrollHeight == its current height (not the shorter content height),
    // so the box would grow but never shrink back down — reset height to
    // 'auto' first to force an accurate remeasure before reading
    // scrollHeight. The pixel height is applied directly to the node rather
    // than relying solely on React's re-render: when the newly measured
    // height equals the previous state value, React bails out of
    // re-rendering, which would otherwise leave the node stuck at 'auto'.
    useEffect(() => {
      if (Platform.OS !== 'web') {
        return;
      }
      const node = inputRef.current as unknown as HTMLTextAreaElement | null;
      if (!node) {
        return;
      }
      node.style.height = 'auto';
      const next = clampHeight(node.scrollHeight, minHeight, maxHeight);
      node.style.height = `${next}px`;
      setInputHeight(next);
    }, [value, minHeight, maxHeight]);

    // WHY: web only — a bare Enter submits while Shift+Enter still inserts a
    // newline. Native onKeyPress never reports shiftKey, so this never fires
    // there; Enter falls back to onSubmitEditing.
    const handleKeyPress = (
      event: NativeSyntheticEvent<
        TextInputKeyPressEventData & { readonly shiftKey?: boolean }
      >,
    ) => {
      if (
        submitOnEnter &&
        Platform.OS === 'web' &&
        event.nativeEvent.key === 'Enter' &&
        !event.nativeEvent.shiftKey
      ) {
        (event as unknown as { preventDefault?: () => void }).preventDefault?.();
        onSubmitEditing?.();
      }
    };

    const handleChangeText = (text: string) => {
      onChangeText(text);
      if (Platform.OS !== 'web') {
        // Wait a frame so the ScrollView's content size has already grown
        // to fit the new text before scrolling, or this can scroll to the
        // previous (shorter) end and leave the caret just out of view.
        requestAnimationFrame(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        });
      }
    };

    const showCounter = typeof maxLength === 'number';
    const atLimit = typeof maxLength === 'number' && value.length >= maxLength;

    const textInput = (
      <TextInput
        autoFocus={autoFocus}
        className={`no-scrollbar ${className ?? ''}`}
        maxLength={maxLength}
        multiline
        onChangeText={handleChangeText}
        onKeyPress={handleKeyPress}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor="rgb(169,156,139)"
        ref={inputRef}
        returnKeyType={submitOnEnter ? 'send' : 'default'}
        style={Platform.OS === 'web' ? { height: inputHeight } : { minHeight }}
        testID={testID}
        value={value}
      />
    );

    return (
      <View>
        {Platform.OS === 'web' ? (
          textInput
        ) : (
          <ScrollView
            nestedScrollEnabled
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight }}
          >
            {textInput}
          </ScrollView>
        )}
        {showCounter && (
          <Text
            className={`px-1 pt-1 text-right text-[11px] ${
              atLimit ? 'text-destructive' : 'text-text-muted'
            }`}
            testID={testID ? `${testID}-char-count` : undefined}
          >
            {value.length}/{maxLength}
          </Text>
        )}
      </View>
    );
  },
);
