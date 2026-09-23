import React from 'react';
import { StyleSheet } from 'react-native';
import { cardStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';

type ICardProps = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof cardStyle>;

const Card = React.forwardRef<HTMLDivElement, ICardProps>(function Card(
  { className, size = 'md', variant = 'elevated', style, ...props },
  ref
) {
  return (
    <div
      className={cardStyle({ size, variant, class: className })}
      {...props}
      // See box/index.web.tsx's WHY -- NativeWind's cssInterop wrapping
      // around this raw `div` can hand this a React Native-style array with
      // a null/undefined hole instead of a plain CSSProperties object;
      // StyleSheet.flatten collapses it to what React DOM expects.
      style={StyleSheet.flatten(style)}
      ref={ref}
    />
  );
});

Card.displayName = 'Card';

export { Card };
