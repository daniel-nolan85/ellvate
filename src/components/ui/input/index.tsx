'use client';
import React from 'react';
import { createInput } from '@gluestack-ui/core/input/creator';
import { PrimitiveIcon, UIIcon } from '@gluestack-ui/core/icon/creator';
import {
  tva,
  withStyleContext,
  type VariantProps,
} from '@gluestack-ui/utils/nativewind-utils';
import { cssInterop } from 'nativewind';
import { Pressable, TextInput, View } from 'react-native';

const SCOPE = 'INPUT';

const UIInput = createInput({
  Icon: UIIcon,
  Input: TextInput,
  Root: withStyleContext(View, SCOPE),
  Slot: Pressable,
});

cssInterop(PrimitiveIcon, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      color: 'classNameColor',
      fill: true,
      height: true,
      stroke: true,
      width: true,
    },
  },
});

const inputStyle = tva({
  base: 'w-full flex-row items-center overflow-hidden rounded-lg border border-line bg-canvas px-3.5 gap-2 data-[focus=true]:border-content data-[invalid=true]:border-destructive data-[disabled=true]:opacity-50',
  variants: {
    size: {
      sm: 'h-9',
      md: 'h-11',
      lg: 'h-[54px] rounded-2xl px-4',
    },
  },
});

const inputFieldStyle = tva({
  base: 'h-full flex-1 py-1 font-sans text-base text-content web:outline-none ios:leading-[0px] web:cursor-text',
});

const inputSlotStyle = tva({ base: 'items-center justify-center' });

const inputIconStyle = tva({
  base: 'h-5 w-5 items-center justify-center text-text-muted',
});

type IInputProps = React.ComponentProps<typeof UIInput> &
  VariantProps<typeof inputStyle> & { className?: string };

const Input = React.forwardRef<React.ComponentRef<typeof UIInput>, IInputProps>(
  function Input({ className, size = 'md', ...props }, ref) {
    return (
      <UIInput
        className={inputStyle({ class: className, size })}
        context={{}}
        ref={ref}
        {...props}
      />
    );
  },
);

type IInputFieldProps = React.ComponentProps<typeof UIInput.Input> & {
  className?: string;
};

const InputField = React.forwardRef<
  React.ComponentRef<typeof UIInput.Input>,
  IInputFieldProps
>(function InputField({ className, ...props }, ref) {
  return (
    <UIInput.Input
      className={inputFieldStyle({ class: className })}
      placeholderTextColor="rgb(169,156,139)"
      ref={ref}
      {...props}
    />
  );
});

type IInputSlotProps = React.ComponentProps<typeof UIInput.Slot> & {
  className?: string;
};

const InputSlot = React.forwardRef<
  React.ComponentRef<typeof UIInput.Slot>,
  IInputSlotProps
>(function InputSlot({ className, ...props }, ref) {
  return (
    <UIInput.Slot
      className={inputSlotStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

type IInputIconProps = React.ComponentProps<typeof UIInput.Icon> & {
  className?: string;
  height?: number;
  width?: number;
};

const InputIcon = React.forwardRef<
  React.ComponentRef<typeof UIInput.Icon>,
  IInputIconProps
>(function InputIcon({ className, ...props }, ref) {
  return (
    <UIInput.Icon
      className={inputIconStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = 'Input';
InputField.displayName = 'InputField';
InputSlot.displayName = 'InputSlot';
InputIcon.displayName = 'InputIcon';

export { Input, InputField, InputIcon, InputSlot };
