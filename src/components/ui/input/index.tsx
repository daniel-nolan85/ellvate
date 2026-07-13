import React from 'react';
import { TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

type InputSize = 'sm' | 'md' | 'lg';

const sizeClassNames: Record<InputSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-11',
};

type InputProps = TextInputProps & {
  size?: InputSize;
  pill?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
};

const joinClassNames = (
  ...classNames: readonly (string | false | undefined)[]
): string => classNames.filter(Boolean).join(' ');

const Input = React.forwardRef<
  React.ComponentRef<typeof TextInput>,
  InputProps
>(function Input(
  {
    size = 'md',
    pill = false,
    isInvalid = false,
    isDisabled = false,
    leftIcon,
    rightIcon,
    className,
    inputClassName,
    editable,
    placeholderTextColor = 'rgb(161,161,170)',
    ...props
  },
  ref
) {
  return (
    <View
      className={joinClassNames(
        'flex-row items-center gap-2 border bg-canvas px-3',
        sizeClassNames[size],
        pill ? 'rounded-full' : 'rounded-lg',
        isInvalid ? 'border-destructive' : 'border-line',
        isDisabled && 'opacity-50',
        className
      )}
    >
      {leftIcon}
      <TextInput
        ref={ref}
        className={joinClassNames(
          'flex-1 font-sans text-base font-normal text-content',
          inputClassName
        )}
        placeholderTextColor={placeholderTextColor}
        editable={isDisabled ? false : editable}
        {...props}
      />
      {rightIcon}
    </View>
  );
});

Input.displayName = 'Input';

export { Input };
export type { InputProps, InputSize };
