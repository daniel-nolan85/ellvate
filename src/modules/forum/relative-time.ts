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
