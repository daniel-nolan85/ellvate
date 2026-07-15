const TIME_ONLY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const pad = (value: number): string => String(value).padStart(2, '0');

export function timeOnlyFromDate(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function timeOnlyToDate(value: string, base = new Date()): Date | null {
  const match = TIME_ONLY_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const date = new Date(base);
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
}

export function isTimeOnly(value: string): boolean {
  return timeOnlyToDate(value) !== null;
}
