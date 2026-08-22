import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAdminEmail } from '@/lib/auth';
import {
  countUnseenContactMessages,
  countUnseenLandingContactMessages,
  countUnseenReports,
  countUnseenWaitlistSignups,
  getAdminSeenState,
} from '@/lib/unseen-counts';

import { signOutAction } from './actions';
import { NavLinks } from './nav-links';

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const adminEmail = await getCurrentAdminEmail();
  const seenState = await getAdminSeenState(adminEmail);
  const [reportsUnseenCount, appContactUnseenCount, landingContactUnseenCount, waitlistUnseenCount] =
    await Promise.all([
      countUnseenReports(seenState.reportsLastSeenAt),
      countUnseenContactMessages(seenState.contactMessagesLastSeenAt),
      countUnseenLandingContactMessages(seenState.landingContactLastSeenAt),
      countUnseenWaitlistSignups(seenState.waitlistLastSeenAt),
    ]);
  // One nav badge covers both contact sources (in-app + landing site) --
  // they read as the same kind of thing to an admin ("messages waiting on
  // me"), even though they're tracked as separate seen-timestamps so
  // visiting one tab doesn't silently clear the other's count.
  const contactUnseenCount = appContactUnseenCount + landingContactUnseenCount;
  // The page defaults to the App tab, so a badge caused entirely by landing
  // page messages would otherwise land an admin on an empty-looking tab --
  // send them straight to the tab that actually has something new.
  const contactHref =
    landingContactUnseenCount > 0 && appContactUnseenCount === 0
      ? '/contact?tab=landing'
      : '/contact';

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-surface px-4 py-6">
        <div>
          <p className="mb-6 px-2 text-sm font-semibold text-content">
            LLV Community
            <span className="block text-xs font-normal text-muted">Admin</span>
          </p>
          <NavLinks
            contactHref={contactHref}
            contactUnseenCount={contactUnseenCount}
            reportsUnseenCount={reportsUnseenCount}
            waitlistUnseenCount={waitlistUnseenCount}
          />
        </div>

        <div className="space-y-2 px-2">
          <p className="truncate text-xs text-muted">{user?.email}</p>
          <form action={signOutAction}>
            <button
              className="text-xs text-muted underline decoration-dotted hover:text-content"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
