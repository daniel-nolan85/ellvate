import React from 'react';
import { StyleSheet } from 'react-native';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

import { vstackStyle } from './styles';

type IVStackProps = React.ComponentProps<'div'> &
  VariantProps<typeof vstackStyle>;

const VStack = React.forwardRef<React.ComponentRef<'div'>, IVStackProps>(
  function VStack({ className, space, reversed, style, ...props }, ref) {
    return (
      <div
        className={vstackStyle({
          space,
          reversed: reversed as boolean,
          class: className,
        })}
        {...props}
        // NativeWind's cssInterop wrapping around this raw `div` (see
        // box/index.web.tsx's own WHY for the fuller story) can hand this a
        // React Native-style array with a null/undefined hole instead of a
        // plain CSSProperties object -- StyleSheet.flatten collapses that
        // down to the single merged object React DOM actually expects.
        style={StyleSheet.flatten(style)}
        ref={ref}
      />
    );
  }
);

VStack.displayName = 'VStack';

export { VStack };
