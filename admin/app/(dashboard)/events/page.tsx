import { createSupabaseAdminClient } from '@/lib/supabase/admin';

import { FeaturedToggle } from './featured-toggle';

interface EventRow {
  readonly id: string;
  readonly title: string;
  readonly starts_at: string;
  readonly place: string;
  readonly featured: boolean;
}

export default async function EventsPage() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('events')
    .select('id, title, starts_at, place, featured')
    .order('featured', { ascending: false })
    .order('starts_at', { ascending: true })
    .limit(100);
  if (error) {
    throw error;
  }
  const events = (data ?? []) as readonly EventRow[];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Events</h1>
        <p className="text-sm text-muted">
          Mark an event as featured — it gets top billing on the Events
          screen. Full moderation (edit/delete) lands in a later pass.
        </p>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="pb-2 font-normal">Title</th>
            <th className="pb-2 font-normal">Starts</th>
            <th className="pb-2 font-normal">Place</th>
            <th className="pb-2 font-normal text-right">Featured</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr className="border-b border-border last:border-0" key={event.id}>
              <td className="py-2 pr-4 text-sm text-content">{event.title}</td>
              <td className="py-2 pr-4 text-xs text-muted">
                {new Date(event.starts_at).toLocaleString()}
              </td>
              <td className="py-2 pr-4 text-xs text-muted">{event.place}</td>
              <td className="py-2 text-right">
                <FeaturedToggle eventId={event.id} featured={event.featured} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
