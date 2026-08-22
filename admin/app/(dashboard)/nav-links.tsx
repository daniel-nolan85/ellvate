'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const NAV_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/posts', label: 'Posts' },
  { href: '/comments', label: 'Comments' },
  { href: '/events', label: 'Events' },
  { href: '/missions', label: 'Missions' },
  { href: '/services', label: 'Services' },
  { href: '/petitions', label: 'Petitions' },
  { href: '/users', label: 'Users' },
  { href: '/reports', label: 'Reports' },
  { href: '/waitlist', label: 'Waitlist' },
  { href: '/contact', label: 'Contact' },
  { href: '/admins', label: 'Admins' },
] as const;

interface NavLinksProps {
  readonly reportsUnseenCount?: number;
  readonly contactUnseenCount?: number;
  readonly waitlistUnseenCount?: number;
}

export function NavLinks({
  reportsUnseenCount = 0,
  contactUnseenCount = 0,
  waitlistUnseenCount = 0,
}: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_LINKS.map((link) => {
        const active =
          link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
        const badge =
          link.href === '/reports'
            ? reportsUnseenCount
            : link.href === '/contact'
              ? contactUnseenCount
              : link.href === '/waitlist'
                ? waitlistUnseenCount
                : 0;

        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
              active
                ? 'bg-surface-raised text-content'
                : 'text-muted hover:bg-surface-raised hover:text-content'
            }`}
            href={link.href}
            key={link.href}
          >
            <span>{link.label}</span>
            {badge > 0 ? (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                {badge > 99 ? '99+' : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
