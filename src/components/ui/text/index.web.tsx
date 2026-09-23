import React from 'react';
import { StyleSheet } from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> & VariantProps<typeof textStyle>;

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      style,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated: isTruncated as boolean,
          bold: bold as boolean,
          underline: underline as boolean,
          strikeThrough: strikeThrough as boolean,
          size,
          sub: sub as boolean,
          italic: italic as boolean,
          highlight: highlight as boolean,
          class: className,
        })}
        {...props}
        // See box/index.web.tsx's WHY -- NativeWind's cssInterop wrapping
        // around this raw `span` can hand this a React Native-style array
        // with a null/undefined hole instead of a plain CSSProperties
        // object; StyleSheet.flatten collapses it to what React DOM expects.
        style={StyleSheet.flatten(style)}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };
