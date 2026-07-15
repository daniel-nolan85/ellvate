export type NativeTimePickerMinuteInterval =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 10
  | 12
  | 15
  | 20
  | 30;

export interface NativeTimePickerProps {
  readonly accessibilityLabel: string;
  readonly minuteInterval?: NativeTimePickerMinuteInterval;
  readonly onChange: (value: Date) => void;
  readonly testID: string;
  readonly value: Date;
}
