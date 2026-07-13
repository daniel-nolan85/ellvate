import React from 'react';
import { Text, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';

type BadgeVariant = 'solid' | 'muted' | 'outline' | 'success' | 'indigo';

const badgeStyle = tva({
  base: 'flex-row items-center justify-center self-start gap-[4px] h-[20px] px-[8px] rounded-[6px]',
  variants: {
    variant: {
      solid: 'bg-primary',
      muted: 'bg-muted',
      outline: 'bg-transparent border border-line',
      success: 'bg-success',
      indigo: 'bg-indigo-subtle',
    },
  },
});

const badgeTextStyle = tva({
  base: 'font-inter-medium text-[12px] leading-[16px]',
  variants: {
    variant: {
      solid: 'text-primary-foreground',
      muted: 'text-secondary-foreground',
      outline: 'text-content',
      success: 'text-primary-foreground',
      indigo: 'text-indigo',
    },
  },
});

type BadgeProps = ViewProps & {
  variant?: BadgeVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  textClassName?: string;
};

const Badge = React.forwardRef<React.ComponentRef<typeof View>, BadgeProps>(
  function Badge(
    { variant = 'muted', leftIcon, rightIcon, children, className, textClassName, ...props },
    ref
  ) {
    return (
      <View className={badgeStyle({ variant, class: className })} {...props} ref={ref}>
        {leftIcon}
        <Text className={badgeTextStyle({ variant, class: textClassName })}>{children}</Text>
        {rightIcon}
      </View>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export type { BadgeProps, BadgeVariant };
