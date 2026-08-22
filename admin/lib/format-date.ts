// These pages are Server Components, so a bare `new Date().toLocaleString()`
// would format in the server's own runtime timezone (UTC on Vercel), not
// the viewing admin's -- and even if it ran client-side, an admin's own
// device timezone isn't actually the meaningful one here. This dashboard
// moderates one specific real-world community, so every timestamp is
// anchored to that community's own local time (Lake Las Vegas, NV) rather
// than wherever an admin happens to be viewing from.
const TIME_ZONE = 'America/Los_Angeles';

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { timeZone: TIME_ZONE });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: TIME_ZONE });
}
