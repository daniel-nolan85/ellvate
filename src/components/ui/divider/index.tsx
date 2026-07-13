import React from 'react';
import { View } from 'react-native';
import type { ViewProps } from 'react-native';
import { tva } from '@gluestack-ui/utils/nativewind-utils';

const dividerStyle = tva({
  base: 'bg-line',
  variants: {
    vertical: {
      true: 'w-px self-stretch',
      false: 'h-px w-full',
    },
  },
});

type DividerProps = ViewProps & {
  vertical?: boolean;
};

const Divider = React.forwardRef<React.ComponentRef<typeof View>, DividerProps>(
  function Divider({ vertical = false, className, ...props }, ref) {
    return (
      <View
        className={dividerStyle({ vertical, class: className })}
        {...props}
        ref={ref}
      />
    );
  }
);

Divider.displayName = 'Divider';

export { Divider };
export type { DividerProps };
