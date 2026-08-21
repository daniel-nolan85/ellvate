const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 604_800_000;

export function formatRelativeTime(
  createdAt: string,
  now: Date = new Date(),
): string {
  const elapsedMs = now.getTime() - new Date(createdAt).getTime();

  if (Number.isNaN(elapsedMs) || elapsedMs < MINUTE_MS) {
    return 'now';
  }
  if (elapsedMs < HOUR_MS) {
    return `${Math.floor(elapsedMs / MINUTE_MS)}m`;
  }
  if (elapsedMs < DAY_MS) {
    return `${Math.floor(elapsedMs / HOUR_MS)}h`;
  }
  if (elapsedMs < WEEK_MS) {
    return `${Math.floor(elapsedMs / DAY_MS)}d`;
  }
  return `${Math.floor(elapsedMs / WEEK_MS)}w`;
}

// The future-facing counterpart to formatRelativeTime -- for a deadline or
// any other timestamp that's ahead of now, not behind it. Reusing
// formatRelativeTime for a future date silently breaks: `now - future` is
// negative, which is always "< MINUTE_MS", so every future date renders as
// "now" regardless of how far out it actually is.
export function formatRelativeTimeUntil(
  deadline: string,
  now: Date = new Date(),
): string {
  const remainingMs = new Date(deadline).getTime() - now.getTime();

  if (Number.isNaN(remainingMs) || remainingMs < MINUTE_MS) {
    return 'soon';
  }
  if (remainingMs < HOUR_MS) {
    return `in ${Math.ceil(remainingMs / MINUTE_MS)}m`;
  }
  if (remainingMs < DAY_MS) {
    return `in ${Math.ceil(remainingMs / HOUR_MS)}h`;
  }
  if (remainingMs < WEEK_MS) {
    return `in ${Math.ceil(remainingMs / DAY_MS)}d`;
  }
  return `in ${Math.ceil(remainingMs / WEEK_MS)}w`;
}
