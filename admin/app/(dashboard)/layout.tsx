import Link from 'next/link';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { signOutAction } from './actions';

const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/events', label: 'Events' },
  { href: '/admins', label: 'Admins' },
] as const;

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-surface px-4 py-6">
        <div>
          <p className="mb-6 px-2 text-sm font-semibold text-content">
            LLV Community
            <span className="block text-xs font-normal text-muted">Admin</span>
          </p>
          <nav className="space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                className="block rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-raised hover:text-content"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
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
