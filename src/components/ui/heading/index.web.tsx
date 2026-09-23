import React, { forwardRef, memo } from 'react';
import { StyleSheet } from 'react-native';
import { headingStyle } from './styles';
import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
type IHeadingProps = VariantProps<typeof headingStyle> &
  React.ComponentPropsWithoutRef<'h1'> & {
    as?: React.ElementType;
  };

const MappedHeading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function MappedHeading(
    {
      size,
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
      style,
      ...props
    },
    ref
  ) {
    // See box/index.web.tsx's WHY -- NativeWind's cssInterop wrapping
    // around these raw `hN` elements can hand this a React Native-style
    // array with a null/undefined hole instead of a plain CSSProperties
    // object; StyleSheet.flatten collapses it to what React DOM expects.
    const flatStyle = StyleSheet.flatten(style);
    switch (size) {
      case '5xl':
      case '4xl':
      case '3xl':
        return (
          <h1
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      case '2xl':
        return (
          <h2
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      case 'xl':
        return (
          <h3
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      case 'lg':
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      case 'md':
        return (
          <h5
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      case 'sm':
      case 'xs':
        return (
          <h6
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
      default:
        return (
          <h4
            className={headingStyle({
              size,
              isTruncated: isTruncated as boolean,
              bold: bold as boolean,
              underline: underline as boolean,
              strikeThrough: strikeThrough as boolean,
              sub: sub as boolean,
              italic: italic as boolean,
              highlight: highlight as boolean,
              class: className,
            })}
            {...props}
            style={flatStyle}
            ref={ref}
          />
        );
    }
  })
);

const Heading = memo(
  forwardRef<HTMLHeadingElement, IHeadingProps>(function Heading(
    { className, size = 'lg', as: AsComp, ...props },
    ref
  ) {
    const {
      isTruncated,
      bold,
      underline,
      strikeThrough,
      sub,
      italic,
      highlight,
    } = props;

    if (AsComp) {
      return (
        <AsComp
          className={headingStyle({
            size,
            isTruncated: isTruncated as boolean,
            bold: bold as boolean,
            underline: underline as boolean,
            strikeThrough: strikeThrough as boolean,
            sub: sub as boolean,
            italic: italic as boolean,
            highlight: highlight as boolean,
            class: className,
          })}
          {...props}
          ref={ref}
        />
      );
    }

    return (
      <MappedHeading className={className} size={size} ref={ref} {...props} />
    );
  })
);

Heading.displayName = 'Heading';

export { Heading };
