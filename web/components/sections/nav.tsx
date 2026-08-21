import { CactusMark } from '@/components/brand/cactus-mark';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/lib/content';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#services', label: 'Services' },
  { href: '#about', label: 'About' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
];

// Plain <a> tags, not next/link -- these are same-page hash jumps, and
// next/link's client-side routing doesn't reliably trigger the browser's
// native (CSS `scroll-behavior: smooth`-driven) scroll-to-anchor when the
// pathname isn't actually changing.
export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2.5 no-underline">
          <CactusMark className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-wide">{BRAND.appName}</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="no-underline transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <Button asChild size="sm">
          <a href="#waitlist">Join the waitlist</a>
        </Button>
      </div>
    </header>
  );
}
