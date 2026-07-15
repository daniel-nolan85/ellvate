'use client';

import {
  createCalendar,
  type CalendarMode,
  type ICalendarProps,
} from '@gluestack-ui/core/calendar/creator';
import { cssInterop } from 'nativewind';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  calendarBodyStyle,
  calendarDayIndicatorStyle,
  calendarDayStyle,
  calendarDayTextStyle,
  calendarFooterStyle,
  calendarGridStyle,
  calendarHeaderButtonStyle,
  calendarHeaderSelectStyle,
  calendarHeaderStyle,
  calendarHeaderTitleStyle,
  calendarStyle,
  calendarWeekDayStyle,
  calendarWeekDayTextStyle,
  calendarWeekDaysHeaderStyle,
  calendarWeekNumberStyle,
  calendarWeekNumberTextStyle,
  calendarWeekStyle,
} from './styles';

cssInterop(View, { className: 'style' });
cssInterop(Text, { className: 'style' });
cssInterop(Pressable, { className: 'style' });

type ViewClassProps = React.ComponentProps<typeof View> & {
  className?: string;
};

type TextClassProps = React.ComponentProps<typeof Text> & {
  className?: string;
};

type PressableClassProps = React.ComponentProps<typeof Pressable> & {
  className?: string;
};

const CalendarRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

const CalendarHeaderRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarHeaderRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarHeaderStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

type HeaderButtonProps = PressableClassProps & {
  disabled?: boolean;
};

const CalendarHeaderButtonRoot = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  HeaderButtonProps
>(function CalendarHeaderButtonRoot({ className, disabled, ...props }, ref) {
  return (
    <Pressable
      className={calendarHeaderButtonStyle({ class: className })}
      disabled={disabled}
      ref={ref}
      {...props}
    />
  );
});

const CalendarHeaderTitleRoot = React.forwardRef<
  React.ElementRef<typeof Text>,
  TextClassProps
>(function CalendarHeaderTitleRoot({ className, ...props }, ref) {
  return (
    <Text
      className={calendarHeaderTitleStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

type HeaderSelectProps = ViewClassProps & {
  items?: { readonly label: string; readonly value: number }[];
  selectedValue?: number;
  onValueChange?: (value: number) => void;
};

// Month/year selectors are part of Gluestack's creator contract. This app uses
// accessible previous/next controls, but keeps neutral roots available for
// callers that opt into the selector API later.
const CalendarHeaderSelectRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  HeaderSelectProps
>(function CalendarHeaderSelectRoot({ className, children }, ref) {
  return (
    <View className={calendarHeaderSelectStyle({ class: className })} ref={ref}>
      {children}
    </View>
  );
});

type CalendarWeekDaysHeaderRootProps = ViewClassProps & {
  format?: 'narrow' | 'short';
};

const CalendarWeekDaysHeaderRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  CalendarWeekDaysHeaderRootProps
>(function CalendarWeekDaysHeaderRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarWeekDaysHeaderStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

const CalendarWeekDayRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarWeekDayRoot({ children, className, ...props }, ref) {
  return (
    <View
      className={calendarWeekDayStyle({ class: className })}
      ref={ref}
      {...props}
    >
      {typeof children === 'string' ? (
        <Text className={calendarWeekDayTextStyle({})}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
});

const CalendarBodyRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarBodyRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarBodyStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

const CalendarGridRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarGridRoot({ className, ...props }, ref) {
  return (
    <View
      accessibilityRole="none"
      className={calendarGridStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

const CalendarWeekRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarWeekRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarWeekStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

type CalendarDayRootProps = PressableClassProps & {
  'data-state'?:
    | 'default'
    | 'disabled'
    | 'outside-month'
    | 'range-end'
    | 'range-middle'
    | 'range-start'
    | 'selected'
    | 'today';
};

const CalendarDayRoot = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  CalendarDayRootProps
>(function CalendarDayRoot(
  { className, 'data-state': state, ...props },
  ref,
) {
  return (
    <Pressable
      className={calendarDayStyle({ class: className, state })}
      ref={ref}
      {...props}
    />
  );
});

type CalendarDayTextRootProps = TextClassProps & {
  state?: {
    readonly isDisabled?: boolean;
    readonly isInRange?: boolean;
    readonly isOutsideMonth?: boolean;
    readonly isRangeEnd?: boolean;
    readonly isRangeStart?: boolean;
    readonly isSelected?: boolean;
    readonly isToday?: boolean;
  };
};

const CalendarDayTextRoot = React.forwardRef<
  React.ElementRef<typeof Text>,
  CalendarDayTextRootProps
>(function CalendarDayTextRoot({ className, state, ...props }, ref) {
  const visualState = state?.isSelected && state.isRangeStart
    ? 'range-start'
    : state?.isSelected && state.isRangeEnd
      ? 'range-end'
      : state?.isInRange
        ? 'range-middle'
        : state?.isSelected
          ? 'selected'
          : state?.isToday
            ? 'today'
            : state?.isDisabled
              ? 'disabled'
              : state?.isOutsideMonth
                ? 'outside-month'
                : 'default';

  return (
    <Text
      className={calendarDayTextStyle({ class: className, state: visualState })}
      ref={ref}
      {...props}
    />
  );
});

type CalendarDayIndicatorRootProps = ViewClassProps & {
  'data-type'?: 'dot' | 'multi-dot' | 'period';
};

const CalendarDayIndicatorRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  CalendarDayIndicatorRootProps
>(function CalendarDayIndicatorRoot(
  { className, 'data-type': type, ...props },
  ref,
) {
  return (
    <View
      className={calendarDayIndicatorStyle({ class: className, type })}
      ref={ref}
      {...props}
    />
  );
});

const CalendarWeekNumberRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarWeekNumberRoot({ children, className, ...props }, ref) {
  return (
    <View
      className={calendarWeekNumberStyle({ class: className })}
      ref={ref}
      {...props}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text className={calendarWeekNumberTextStyle({})}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
});

const CalendarFooterRoot = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewClassProps
>(function CalendarFooterRoot({ className, ...props }, ref) {
  return (
    <View
      className={calendarFooterStyle({ class: className })}
      ref={ref}
      {...props}
    />
  );
});

const UICalendar = createCalendar({
  Body: CalendarBodyRoot,
  Day: CalendarDayRoot,
  DayIndicator: CalendarDayIndicatorRoot,
  DayText: CalendarDayTextRoot,
  Footer: CalendarFooterRoot,
  Grid: CalendarGridRoot,
  Header: CalendarHeaderRoot,
  HeaderMonthSelect: CalendarHeaderSelectRoot,
  HeaderNextButton: CalendarHeaderButtonRoot,
  HeaderPrevButton: CalendarHeaderButtonRoot,
  HeaderTitle: CalendarHeaderTitleRoot,
  HeaderYearSelect: CalendarHeaderSelectRoot,
  Root: CalendarRoot,
  Week: CalendarWeekRoot,
  WeekDay: CalendarWeekDayRoot,
  WeekDaysHeader: CalendarWeekDaysHeaderRoot,
  WeekNumber: CalendarWeekNumberRoot,
});

type OmittedCalendarKeys = 'defaultValue' | 'mode' | 'onValueChange' | 'value';

type SingleModeProps = {
  readonly defaultValue?: Date;
  readonly mode?: 'single';
  readonly onValueChange?: (value: Date) => void;
  readonly value?: Date;
};

type MultipleModeProps = {
  readonly defaultValue?: Date[];
  readonly mode: 'multiple';
  readonly onValueChange?: (value: Date[]) => void;
  readonly value?: Date[];
};

type RangeModeProps = {
  readonly defaultValue?: { readonly from: Date; readonly to?: Date };
  readonly mode: 'range';
  readonly onValueChange?: (value: { from: Date; to?: Date }) => void;
  readonly value?: { readonly from: Date; readonly to?: Date };
};

export type CalendarProps = (
  | SingleModeProps
  | MultipleModeProps
  | RangeModeProps
) &
  Omit<ICalendarProps, OmittedCalendarKeys> &
  Omit<ViewClassProps, OmittedCalendarKeys>;

export const Calendar = React.forwardRef<
  React.ElementRef<typeof View>,
  CalendarProps
>(function Calendar(props, ref) {
  return <UICalendar ref={ref} {...(props as ICalendarProps)} />;
});

export const CalendarBody = UICalendar.Body;
export const CalendarDay = UICalendar.Day;
export const CalendarDayIndicator = UICalendar.DayIndicator;
export const CalendarDayText = UICalendar.DayText;
export const CalendarFooter = UICalendar.Footer;
export const CalendarGrid = UICalendar.Grid;
export const CalendarHeader = UICalendar.Header;
export const CalendarHeaderMonthSelect = UICalendar.HeaderMonthSelect;
export const CalendarHeaderNextButton = UICalendar.HeaderNextButton;
export const CalendarHeaderPrevButton = UICalendar.HeaderPrevButton;
export const CalendarHeaderTitle = UICalendar.HeaderTitle;
export const CalendarHeaderYearSelect = UICalendar.HeaderYearSelect;
export const CalendarWeek = UICalendar.Week;
export const CalendarWeekDay = UICalendar.WeekDay;
export const CalendarWeekDaysHeader = UICalendar.WeekDaysHeader;
export const CalendarWeekNumber = UICalendar.WeekNumber;

export type {
  CalendarMarker,
  CalendarMarkers,
  DayState,
} from '@gluestack-ui/core/calendar/creator';
export type { CalendarMode, ICalendarProps };
