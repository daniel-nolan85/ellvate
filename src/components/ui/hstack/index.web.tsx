import React from 'react';
import { StyleSheet } from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import { hstackStyle } from './styles';

type IHStackProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof hstackStyle>;

const HStack = React.forwardRef<React.ComponentRef<'div'>, IHStackProps>(
  function HStack({ className, space, reversed, style, ...props }, ref) {
    return (
      <div
        className={hstackStyle({
          space,
          reversed: reversed as boolean,
          class: className,
        })}
        {...props}
        // See box/index.web.tsx's WHY -- NativeWind's cssInterop wrapping
        // around this raw `div` can hand this a React Native-style array
        // with a null/undefined hole instead of a plain CSSProperties
        // object; StyleSheet.flatten collapses it to what React DOM expects.
        style={StyleSheet.flatten(style)}
        ref={ref}
      />
    );
  }
);

HStack.displayName = 'HStack';

export { HStack };
