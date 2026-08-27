import type { ReactNode } from 'react';
import Link from 'next/link';

import { CactusMark } from '@/components/brand/cactus-mark';
import { NolancodeLogo } from '@/components/brand/nolancode-logo';
import { Wordmark } from '@/components/brand/wordmark';
import { CopyrightYear } from '@/components/copyright-year';
import { BRAND } from '@/lib/content';

interface LegalPageShellProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly lastUpdated: string;
  readonly otherPolicies: readonly { readonly href: string; readonly label: string }[];
  readonly children: ReactNode;
}

// Shared chrome for the Terms of Service, Privacy Policy, and Community
// Guidelines pages -- same header/footer, same typographic rhythm, each
// page supplies only its own heading and content sections. Kept out of the
// route files themselves so they stay orchestration-thin (see
// check-saos-structure.py's thick-framework-file threshold).
export function LegalPageShell({
  children,
  eyebrow = 'Legal',
  lastUpdated,
  otherPolicies,
  title,
}: LegalPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <CactusMark animated className="h-6 w-6" />
            <Wordmark className="text-base text-foreground" />
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-accent">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-10">{children}</div>
      </main>

      <footer className="border-t border-white/10 bg-[#080c10]">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-white/70 sm:flex-row">
          <div className="flex items-center gap-2">
            <CactusMark animated className="h-6 w-6" />
            <span className="flex items-center gap-1.5">
              &copy; <CopyrightYear /> <Wordmark />
            </span>
          </div>
          <a href={BRAND.companyUrl} target="_blank" rel="noopener noreferrer" aria-label={BRAND.company}>
            <NolancodeLogo iconSize={16} variant="dark" />
          </a>
          <span>
            See also{' '}
            {otherPolicies.map((policy, index) => (
              <span key={policy.href}>
                {index > 0 ? ' and ' : ''}
                <Link href={policy.href} className="underline-offset-2 hover:text-white hover:underline">
                  {policy.label}
                </Link>
              </span>
            ))}
          </span>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  children,
  id,
  title,
}: {
  readonly id: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <div className="mt-3 space-y-4 text-[15px] leading-7 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
