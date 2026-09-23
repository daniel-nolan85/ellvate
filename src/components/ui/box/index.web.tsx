import React from 'react';
import { StyleSheet } from 'react-native';
import { boxStyle } from './styles';

import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type IBoxProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof boxStyle> & { className?: string };

const Box = React.forwardRef<HTMLDivElement, IBoxProps>(function Box(
  { className, style, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={boxStyle({ class: className })}
      {...props}
      // NativeWind's cssInterop wrapping around this raw `div` (rather than
      // react-native-web's own View, which normalizes this itself) can hand
      // this a React Native-style array with a null/undefined hole instead
      // of a plain CSSProperties object -- setting it straight through as
      // `style` reaches React DOM's setValueForStyles unflattened, which
      // throws "Indexed property setter is not supported" on the array's
      // numeric indices the first time a hole lands at index 0.
      // StyleSheet.flatten collapses it to the single merged object React
      // DOM actually expects, on every platform (it's a no-op for an
      // already-plain object or undefined).
      style={StyleSheet.flatten(style)}
    />
  );
});

Box.displayName = 'Box';
export { Box };
