import { tva } from '@gluestack-ui/utils/nativewind-utils';

export const calendarStyle = tva({
  base: 'w-full gap-1 rounded-[20px] border border-line bg-canvas p-3',
  variants: {
    size: {
      sm: 'gap-1 p-2',
      md: 'gap-1 p-3',
      lg: 'gap-2 p-4',
    },
  },
  defaultVariants: { size: 'md' },
});

export const calendarHeaderStyle = tva({
  base: 'mb-1 flex-row items-center justify-between',
});

export const calendarHeaderButtonStyle = tva({
  base: 'h-10 w-10 items-center justify-center rounded-full active:bg-secondary disabled:opacity-30',
});

export const calendarHeaderTitleStyle = tva({
  base: 'font-inter-bold text-[15px] text-content',
});

export const calendarHeaderSelectStyle = tva({
  base: 'rounded-lg border border-line bg-canvas px-2 py-1',
});

export const calendarWeekDaysHeaderStyle = tva({
  base: 'mb-1 flex-row',
});

export const calendarWeekDayStyle = tva({
  base: 'min-w-8 flex-1 items-center justify-center',
});

export const calendarWeekDayTextStyle = tva({
  base: 'font-inter-semibold text-[10px] uppercase tracking-[0.5px] text-text-subtle',
});

export const calendarBodyStyle = tva({ base: 'gap-0' });
export const calendarGridStyle = tva({ base: 'gap-0' });
export const calendarWeekStyle = tva({ base: 'flex-row' });

export const calendarDayStyle = tva({
  base: 'relative aspect-square min-w-8 flex-1 items-center justify-center rounded-xl active:bg-secondary',
  variants: {
    state: {
      default: '',
      disabled: 'opacity-30',
      'outside-month': 'opacity-30',
      'range-end': 'bg-accent',
      'range-middle': 'rounded-none bg-secondary',
      'range-start': 'bg-accent',
      selected: 'bg-accent',
      today: 'border border-accent',
    },
  },
});

export const calendarDayTextStyle = tva({
  base: 'z-10 font-inter-medium text-[13px] text-content',
  variants: {
    state: {
      default: 'text-content',
      disabled: 'text-text-subtle',
      'outside-month': 'text-text-subtle',
      'range-end': 'font-inter-semibold text-accent-foreground',
      'range-middle': 'text-content',
      'range-start': 'font-inter-semibold text-accent-foreground',
      selected: 'font-inter-semibold text-accent-foreground',
      today: 'font-inter-semibold text-accent',
    },
  },
});

export const calendarDayIndicatorStyle = tva({
  base: 'absolute bottom-1 z-0 flex-row gap-0.5',
  variants: {
    type: {
      dot: 'flex-row gap-0.5',
      'multi-dot': 'flex-row gap-0.5',
      period: 'absolute inset-0 rounded-xl opacity-20',
    },
  },
});

export const calendarWeekNumberStyle = tva({
  base: 'mr-1 w-8 items-center justify-center',
});

export const calendarWeekNumberTextStyle = tva({
  base: 'text-[10px] text-text-subtle',
});

export const calendarFooterStyle = tva({
  base: 'mt-2 border-t border-line pt-2',
});
