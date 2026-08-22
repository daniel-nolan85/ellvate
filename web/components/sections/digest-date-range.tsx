'use client';

import * as React from 'react';

// Mirrors the app's own week boundary (send_weekly_digest in
// ../../../supabase/migrations/0015_weekly_digest.sql): digests go out
// Monday morning covering the Monday-through-Sunday week that just ended.
// This computes that same "most recently completed week" so the label on
// the landing page is never a stale hardcoded date.
function getLastCompletedWeek(now: Date): { start: Date; end: Date } {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setHours(0, 0, 0, 0);
  thisMonday.setDate(now.getDate() - daysSinceMonday);

  const start = new Date(thisMonday);
  start.setDate(thisMonday.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

// Computed client-side (rather than in the Server Component that renders
// it) specifically so this stays correct on a statically-cached/prerendered
// page -- a server-rendered `new Date()` would freeze at build/deploy time,
// not update per visitor. Starts blank and fills in on mount to avoid a
// hydration mismatch between server and client output.
export function DigestDateRange() {
  const [label, setLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const { start, end } = getLastCompletedWeek(new Date());
    setLabel(
      `${start.toLocaleDateString('en-US', DATE_FORMAT)} – ${end.toLocaleDateString('en-US', DATE_FORMAT)}`
    );
  }, []);

  return <span className="text-xs text-muted-foreground">{label ?? ' '}</span>;
}
