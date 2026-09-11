import Link from 'next/link';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const REPORT_TABLES = [
  'post_reports',
  'comment_reports',
  'event_comment_reports',
  'mission_comment_reports',
  'service_review_reports',
  'petition_reports',
  'petition_comment_reports',
] as const;

const COMMENT_TABLES = [
  'comments',
  'event_comments',
  'mission_comments',
  'service_reviews',
  'petition_comments',
] as const;

async function headCount(table: string): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function countPetitionsAwaitingHoaEmail(): Promise<number> {
  const { count, error } = await createSupabaseAdminClient()
    .from('petitions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'succeeded')
    .is('hoa_email_sent_at', null);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export default async function OverviewPage() {
  const [
    posts,
    missions,
    services,
    events,
    users,
    contact,
    petitions,
    awaitingHoaEmail,
    ...reportCounts
  ] = await Promise.all([
    headCount('posts'),
    headCount('missions'),
    headCount('service_listings'),
    headCount('events'),
    headCount('app_users'),
    headCount('contact_messages'),
    headCount('petitions'),
    countPetitionsAwaitingHoaEmail(),
    ...REPORT_TABLES.map(headCount),
  ]);
  const reports = reportCounts.reduce((sum, n) => sum + n, 0);
  const comments = (await Promise.all(COMMENT_TABLES.map(headCount))).reduce(
    (sum, n) => sum + n,
    0,
  );

  const stats = [
    { label: 'Posts', value: posts, href: '/posts' },
    { label: 'Comments & reviews', value: comments, href: '/comments' },
    { label: 'Events', value: events, href: '/events' },
    { label: 'Missions', value: missions, href: '/missions' },
    { label: 'Services', value: services, href: '/services' },
    { label: 'Petitions', value: petitions, href: '/petitions' },
    { label: 'Awaiting board email', value: awaitingHoaEmail, href: '/petitions' },
    { label: 'Users', value: users, href: '/users' },
    { label: 'Reports', value: reports, href: '/reports' },
    { label: 'Contact messages', value: contact, href: '/contact' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-content">Overview</h1>
        <p className="text-sm text-muted">At a glance across the community.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-raised"
            href={stat.href}
            key={stat.href}
          >
            <p className="text-2xl font-semibold text-content">{stat.value}</p>
            <p className="text-xs text-muted">{stat.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
