// The React Query key for My Activity's unpaginated stat-tile totals (see
// src/modules/activity/use-activity-counts.ts). Every mutation that can
// change one of those totals -- creating/deleting a post, event, mission,
// service listing, or petition; completing a mission; joining an event;
// signing a petition -- needs to invalidate this exact key, but those
// mutations live in their own content-type modules (events, missions,
// forum, services, petitions). Importing use-activity-counts.ts directly
// from there would import the whole activity module's barrel (ActivityScreen
// included), which itself imports every one of those content modules back
// -- a real circular dependency. Living here instead, alongside this app's
// other small cross-cutting helpers (cursor-pagination.ts, date-only.ts),
// lets both sides depend on it with neither depending on the other.
export const activityCountsKey = (userId: string | null) =>
  ['activity', 'counts', userId ?? 'demo-user'] as const;
